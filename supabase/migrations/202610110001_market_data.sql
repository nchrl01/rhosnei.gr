-- Run in the Supabase SQL editor. Nothing here mints NFTs or accepts milestones.
create table public.upic_market_assets (
  id uuid primary key default gen_random_uuid(),
  chain text not null check (chain in ('ethereum','bsc','base','solana','tron','monad','hyperevm','megaeth','xlayer','robinhood')),
  token_address text not null,
  pool_address text not null,
  poll_seconds integer not null default 900 check (poll_seconds between 60 and 86400),
  enabled boolean not null default true,
  last_attempt timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (chain, token_address)
);
create table public.upic_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.upic_market_assets(id),
  observed_at timestamptz not null,
  snapshot jsonb not null,
  raw_payload jsonb not null,
  raw_sha256 text not null check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  block_context jsonb not null,
  created_at timestamptz not null default now(),
  check (snapshot->>'verification' = 'provider-observation'),
  check ((snapshot->>'milestoneEligible')::boolean = false)
);
create index upic_market_snapshots_latest on public.upic_market_snapshots(asset_id, observed_at desc);
create table public.upic_market_budget (
  id integer primary key check (id = 1),
  day date not null,
  used integer not null default 0,
  next_request timestamptz not null
);

alter table public.upic_market_assets enable row level security;
alter table public.upic_market_snapshots enable row level security;
alter table public.upic_market_budget enable row level security;
revoke all on public.upic_market_assets, public.upic_market_snapshots, public.upic_market_budget from anon, authenticated;
revoke all on public.upic_market_snapshots from service_role;
grant select on public.upic_market_snapshots to service_role;
grant select, update on public.upic_market_assets to service_role;

-- Serializes registration to enforce the asset limit across concurrent admins.
create function public.upic_register_market_asset(p_chain text, p_token text, p_pool text, p_poll_seconds integer, p_max_assets integer)
returns setof public.upic_market_assets language plpgsql security definer set search_path = '' as $$
begin
  if p_max_assets not between 1 and 10000 or p_poll_seconds not between 60 and 86400 then
    raise exception 'invalid registration configuration';
  end if;
  perform pg_advisory_xact_lock(841101);
  if exists(select 1 from public.upic_market_assets where chain=p_chain and token_address=p_token) then
    -- Changing pool selection must be an explicit later operation: preserve identity.
    return query select * from public.upic_market_assets where chain=p_chain and token_address=p_token and pool_address=p_pool;
    return;
  end if;
  if (select count(*) from public.upic_market_assets where enabled) >= p_max_assets then return; end if;
  return query insert into public.upic_market_assets(chain, token_address, pool_address, poll_seconds)
    values(p_chain,p_token,p_pool,p_poll_seconds) returning *;
end;
$$;

-- A global database lease reserves one upstream request before network I/O.
-- Visitor reads never call the market provider. Failed requests also spend quota.
create function public.upic_claim_market_asset(p_daily_limit integer, p_spacing integer)
returns setof public.upic_market_assets language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'UTC')::date;
  v_budget public.upic_market_budget;
  v_asset public.upic_market_assets;
begin
  if p_daily_limit not between 1 and 100000 or p_spacing not between 6 and 86400 then
    raise exception 'invalid budget configuration';
  end if;
  perform pg_advisory_xact_lock(841102);
  insert into public.upic_market_budget(id,day,used,next_request) values(1,v_day,0,v_now) on conflict do nothing;
  select * into v_budget from public.upic_market_budget where id=1 for update;
  if v_budget.day <> v_day then
    update public.upic_market_budget set day=v_day,used=0 where id=1;
    v_budget.used := 0;
  end if;
  if v_budget.used >= p_daily_limit or v_budget.next_request > v_now then return; end if;
  select * into v_asset from public.upic_market_assets
    where enabled and (last_attempt is null or last_attempt + poll_seconds * interval '1 second' <= v_now)
    order by last_attempt asc nulls first, created_at asc limit 1 for update skip locked;
  if not found then return; end if;
  update public.upic_market_budget set used=used+1,next_request=v_now+p_spacing*interval '1 second' where id=1;
  update public.upic_market_assets set last_attempt=v_now where id=v_asset.id;
  return next v_asset;
end;
$$;

-- Append-only evidence. Snapshot rows cannot be updated/deleted by the Worker.
create function public.upic_record_market_snapshot(p_asset uuid, p_snapshot jsonb, p_raw jsonb, p_digest text, p_block jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asset public.upic_market_assets;
begin
  select * into v_asset from public.upic_market_assets where id=p_asset;
  if not found or p_snapshot->>'chain' is distinct from v_asset.chain
    or p_snapshot->>'token' is distinct from v_asset.token_address
    or p_snapshot->>'pool' is distinct from v_asset.pool_address
    or p_snapshot->>'verification' is distinct from 'provider-observation'
    or p_snapshot->>'milestoneEligible' is distinct from 'false' then
    raise exception 'snapshot identity mismatch';
  end if;
  insert into public.upic_market_snapshots(asset_id,observed_at,snapshot,raw_payload,raw_sha256,block_context)
    values(p_asset,(p_snapshot->>'observedAt')::timestamptz,p_snapshot,p_raw,p_digest,p_block);
  update public.upic_market_assets set last_error=null where id=p_asset;
end;
$$;
revoke all on function public.upic_register_market_asset(text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.upic_claim_market_asset(integer,integer) from public, anon, authenticated;
revoke all on function public.upic_record_market_snapshot(uuid,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.upic_register_market_asset(text,text,text,integer,integer) to service_role;
grant execute on function public.upic_claim_market_asset(integer,integer) to service_role;
grant execute on function public.upic_record_market_snapshot(uuid,jsonb,jsonb,text,jsonb) to service_role;
