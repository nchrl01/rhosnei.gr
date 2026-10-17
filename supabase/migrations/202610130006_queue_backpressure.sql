-- A failing or busy source must not grow an unbounded queue every polling minute.
create or replace function public.upic_job_enqueue(p_kind text,p_key text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j uuid;begin
 if p_kind='verify' and p_payload->>'blockNumber' is null then
  perform pg_advisory_xact_lock(hashtextextended('verify:'||(p_payload->>'assetKey'),0));
  select id into j from public.upic_jobs where kind='verify' and payload->>'assetKey'=p_payload->>'assetKey'
   and payload->>'blockNumber' is null and state in ('queued','leased') order by created_at limit 1;
  if j is not null then return j;end if;
 end if;
 insert into public.upic_jobs(kind,dedupe_key,payload) values(p_kind,p_key,p_payload)
 on conflict(dedupe_key) do update set payload=case when upic_jobs.state='queued' then excluded.payload else upic_jobs.payload end returning id into j;return j;
end;$$;
create or replace function public.upic_job_take(p_kind text,p_seconds integer default 300) returns setof public.upic_jobs
language plpgsql security definer set search_path='' as $$
begin
 update public.upic_jobs set state='failed',last_error='lease-attempts-exhausted',lease_until=null
 where kind=p_kind and state='leased' and lease_until<now() and attempts>=5;
 return query update public.upic_jobs set state='leased',lease_token=gen_random_uuid(),lease_until=now()+greatest(1,least(p_seconds,900))*interval '1 second',attempts=attempts+1
 where id=(select id from public.upic_jobs where kind=p_kind and attempts<5 and not_before<=now() and (state='queued' or (state='leased' and lease_until<now())) order by created_at for update skip locked limit 1) returning *;
end;$$;
revoke all on function public.upic_job_enqueue(text,text,jsonb),public.upic_job_take(text,integer) from public,anon,authenticated;
grant execute on function public.upic_job_enqueue(text,text,jsonb),public.upic_job_take(text,integer) to service_role;
