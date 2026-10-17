create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon,authenticated,service_role to upic;
grant usage on schema public to anon,authenticated,service_role;
create table public.upic_migrations (name text primary key,applied_at timestamptz default now());
