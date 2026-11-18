-- Human-in-the-loop review audit columns for detections.
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

alter table public.detections
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists ai_severity severity,
  add column if not exists ai_confidence int;

comment on column public.detections.reviewed_at is 'When a human operator approved/rejected this AI detection';
comment on column public.detections.review_note is 'Optional reviewer note / override justification';
comment on column public.detections.ai_severity is 'Original AI-suggested severity before human override';
comment on column public.detections.ai_confidence is 'Original AI-suggested confidence before human override';
-- verified_by (existing uuid -> profiles.id) records WHO reviewed.

-- Ensure staff can insert/update/delete detections (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections'
      and policyname = 'detections_staff_insert'
  ) then
    create policy detections_staff_insert on public.detections
      for insert to authenticated
      with check (public.is_staff());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections'
      and policyname = 'detections_staff_update'
  ) then
    create policy detections_staff_update on public.detections
      for update to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections'
      and policyname = 'detections_staff_delete'
  ) then
    create policy detections_staff_delete on public.detections
      for delete to authenticated
      using (public.is_staff());
  end if;
end $$;

-- Guests (role 'user') can read detections but cannot write — enforced by is_staff().
-- Reload PostgREST schema cache so the new columns are exposed via the API.
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;

comment on table public.detections is 'AI waste detections with human-in-the-loop review audit fields';
