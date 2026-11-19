-- Completion-photo evidence for cleaning tasks (driver uploads proof of cleaned area).
alter table public.cleaning_tasks
  add column if not exists evidence_url text;

comment on column public.cleaning_tasks.evidence_url is 'Public URL of driver completion photo (Supabase Storage)';

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
