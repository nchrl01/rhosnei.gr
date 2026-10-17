-- One request per checkpoint, regardless of the number of tracked collections.
create function public.upic_enqueue_many(p_jobs jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare j jsonb; n integer:=0; begin
 if jsonb_array_length(p_jobs)>100 then raise exception 'batch too large';end if;
 for j in select value from jsonb_array_elements(p_jobs) loop
  perform public.upic_job_enqueue(j->>'kind',j->>'key',j->'payload');n:=n+1;
 end loop;return n;
end;$$;

create function public.upic_checkpoint(p_frames jsonb,p_jobs jsonb,p_candles jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare row jsonb;begin
 if jsonb_array_length(p_frames)>100 or jsonb_array_length(p_candles)>200 then raise exception 'batch too large';end if;
 for row in select value from jsonb_array_elements(p_frames) loop
  update public.upic_assets set latest=row->'frame' where asset_key=row->>'key';
 end loop;
 perform public.upic_enqueue_many(p_jobs);
 for row in select value from jsonb_array_elements(p_candles) loop
  insert into public.upic_candles(asset_key,time,bar) values(row->>'key',(row->>'time')::bigint,row->'bar')
  on conflict(asset_key,time) do update set bar=excluded.bar;
 end loop;
end;$$;

create function public.upic_retention() returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.upic_candles where time<extract(epoch from now()-interval '1 day')*1000;
 delete from public.upic_auth_nonces where expires_at<now()-interval '1 hour';
 delete from public.upic_jobs where state='complete' and created_at<now()-interval '30 days';
 delete from public.upic_intents where state in ('expired','complete') and created_at<now()-interval '30 days';
 delete from public.upic_orders where not active and created_at<now()-interval '30 days';
 -- Permanent archives and chain-event evidence are deliberately retained.
end;$$;
revoke all on function public.upic_enqueue_many(jsonb),public.upic_checkpoint(jsonb,jsonb,jsonb),public.upic_retention() from public,anon,authenticated;
grant execute on function public.upic_enqueue_many(jsonb),public.upic_checkpoint(jsonb,jsonb,jsonb),public.upic_retention() to service_role;
