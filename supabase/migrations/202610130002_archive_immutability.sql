create function public.upic_immutable_archive() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'immutable archive';end if;
 if new is distinct from old then raise exception 'immutable archive';end if;
 return new;
end;$$;
create trigger immutable_archives before update or delete on public.upic_archives for each row execute function public.upic_immutable_archive();
create trigger immutable_events before update or delete on public.upic_chain_events for each row execute function public.upic_immutable_archive();
revoke delete on public.upic_archives,public.upic_chain_events from service_role;
