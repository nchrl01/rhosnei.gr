alter table public.upic_jobs drop constraint upic_jobs_kind_check;
alter table public.upic_jobs add constraint upic_jobs_kind_check check(kind in ('verify','attest','render','publish','index'));
