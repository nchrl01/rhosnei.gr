-- Additive: preserves the original append-only provider observations.
alter table public.upic_market_assets drop constraint upic_market_assets_chain_check;
alter table public.upic_market_assets add constraint upic_market_assets_chain_check check(chain in ('ethereum','bsc','base','arbitrum','solana','tron','monad','hyperevm','xlayer','robinhood','megaeth'));
create table public.upic_assets (
 asset_key text primary key,chain text not null,token text not null,pool text not null,policy jsonb not null,
 name text not null,symbol text not null,enabled boolean not null default true,approved boolean not null default false,
 latest jsonb,evidence jsonb,evidence_hash text,evidence_uri text,verified_at timestamptz,confirmed_evidence jsonb,
 unique(chain,token)
);
create table public.upic_collections (
 address text primary key,asset_key text unique not null references public.upic_assets,
 chain text not null,token text not null,name text not null,symbol text not null,initiator text not null,
 stage smallint not null default 0 check(stage between 0 and 8),minted integer not null default 1 check(minted between 1 and 100),
 verified_cap text,history_from bigint,evidence_uri text,created_at timestamptz not null default now()
);
create table public.upic_editions (
 collection text references public.upic_collections,edition integer check(edition between 1 and 100),owner text not null,
 seed text not null,stage smallint not null,metadata_uri text not null default '',image text not null default '',animation_url text not null default '',
 media_stage smallint not null default 0,transfer_nonce numeric not null default 1,
 primary key(collection,edition)
);
create table public.upic_intents (
 id uuid primary key default gen_random_uuid(),wallet text not null,asset_key text references public.upic_assets,
 collection text,edition integer not null,stage smallint not null,payload jsonb not null,
 state text not null default 'preparing' check(state in ('preparing','ready','submitted','expired','complete')),
 artifact jsonb,signature text,expires_at timestamptz not null,created_at timestamptz not null default now()
);
create unique index upic_intent_active_edition on public.upic_intents(asset_key,edition) where state in ('preparing','ready','submitted');
create table public.upic_jobs (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('verify','render','publish','index')),
 dedupe_key text unique not null,payload jsonb not null,state text not null default 'queued',attempts integer not null default 0,
 lease_token uuid,lease_until timestamptz,not_before timestamptz not null default now(),result jsonb,last_error text,
 created_at timestamptz not null default now()
);
create index upic_jobs_due on public.upic_jobs(kind,state,not_before);
create table public.upic_archives (
 collection text not null,edition integer not null,stage smallint not null,uri text not null,input jsonb not null,media jsonb not null,
 primary key(collection,edition,stage)
);
create table public.upic_orders (
 id text primary key,collection text not null references public.upic_collections,edition integer not null,seller text not null,
 price text not null,expiry bigint not null,nonce text not null,ownership_nonce text not null,signature text not null,
 order_data jsonb not null,active boolean not null default true,created_at timestamptz not null default now(),unique(seller,nonce)
);
create table public.upic_chain_events (chain_id integer not null,block_number bigint not null,block_hash text not null,tx text not null,log_index integer not null,event jsonb not null,primary key(chain_id,tx,log_index));
create table public.upic_auth_nonces (nonce text primary key,wallet text not null,expires_at timestamptz not null,consumed boolean not null default false);
create table public.upic_candles (asset_key text not null,time bigint not null,bar jsonb not null,primary key(asset_key,time));

create function public.upic_job_enqueue(p_kind text,p_key text,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare j uuid;begin
 insert into public.upic_jobs(kind,dedupe_key,payload) values(p_kind,p_key,p_payload)
 on conflict(dedupe_key) do update set payload=case when upic_jobs.state='queued' then excluded.payload else upic_jobs.payload end returning id into j;return j;
end;$$;
create function public.upic_job_take(p_kind text,p_seconds integer default 300) returns setof public.upic_jobs language plpgsql security definer set search_path='' as $$
begin
 return query update public.upic_jobs set state='leased',lease_token=gen_random_uuid(),lease_until=now()+least(p_seconds,900)*interval '1 second',attempts=attempts+1
 where id=(select id from public.upic_jobs where kind=p_kind and attempts<5 and not_before<=now() and (state='queued' or (state='leased' and lease_until<now())) order by created_at for update skip locked limit 1) returning *;
end;$$;
create function public.upic_job_finish(p_id uuid,p_lease uuid,p_result jsonb,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.upic_jobs set state=case when p_error is null then 'complete' when attempts>=5 then 'failed' else 'queued' end,
 result=p_result,last_error=p_error,not_before=now()+interval '1 minute'*greatest(1,attempts),lease_until=null
 where id=p_id and state='leased' and lease_token=p_lease and lease_until>=now();return found;
end;$$;
create function public.upic_reserve(p_wallet text,p_asset text,p_collection text,p_stage integer,p_payload jsonb) returns setof public.upic_intents language plpgsql security definer set search_path='' as $$
declare ed integer;begin
 perform pg_advisory_xact_lock(841103);
 perform pg_advisory_xact_lock(hashtextextended(p_asset,0));
 update public.upic_intents set state='expired' where state in ('preparing','ready','submitted') and expires_at<now();
 if exists(select 1 from public.upic_intents where wallet=p_wallet and asset_key<>p_asset and state in ('preparing','ready','submitted')) then raise exception 'another preparation active';end if;
 if exists(select 1 from public.upic_intents where asset_key=p_asset and wallet=p_wallet and state in ('preparing','ready','submitted')) then
 return query select * from public.upic_intents where asset_key=p_asset and wallet=p_wallet and state in ('preparing','ready','submitted') order by created_at desc limit 1;return;end if;
 if (select count(*) from public.upic_intents where state in ('preparing','ready','submitted'))>=20 then raise exception 'preparation capacity reached';end if;
 if p_collection is null then ed=1;
 else select n into ed from generate_series(2,100) n where not exists(select 1 from public.upic_editions where collection=p_collection and edition=n)
 and not exists(select 1 from public.upic_intents where asset_key=p_asset and edition=n and state in ('preparing','ready','submitted')) order by n limit 1;end if;
 if ed is null then raise exception 'sold out';end if;
 return query insert into public.upic_intents(wallet,asset_key,collection,edition,stage,payload,expires_at) values(p_wallet,p_asset,p_collection,ed,p_stage,p_payload,now()+interval '1 hour') returning *;
end;$$;
create function public.upic_auth_consume(p_nonce text,p_wallet text) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.upic_auth_nonces set consumed=true where nonce=p_nonce and wallet=p_wallet and not consumed and expires_at>now();return found;end;$$;

-- No public direct table access. All browser operations go through the API.
do $$declare t text;begin foreach t in array array['upic_assets','upic_collections','upic_editions','upic_intents','upic_jobs','upic_archives','upic_orders','upic_chain_events','upic_auth_nonces','upic_candles'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop;end;$$;
revoke all on function public.upic_job_enqueue(text,text,jsonb),public.upic_job_take(text,integer),public.upic_job_finish(uuid,uuid,jsonb,text),public.upic_reserve(text,text,text,integer,jsonb),public.upic_auth_consume(text,text) from public,anon,authenticated;
grant execute on function public.upic_job_enqueue(text,text,jsonb),public.upic_job_take(text,integer),public.upic_job_finish(uuid,uuid,jsonb,text),public.upic_reserve(text,text,text,integer,jsonb),public.upic_auth_consume(text,text) to service_role;
