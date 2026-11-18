-- ============================================================
-- SI BRIDGES — CRUD enablement
-- Adds staff DELETE policies missing from the original schema so
-- admins/operators can fully manage records from the Data & Users
-- page. Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create policy "staff delete detections" on public.detections for delete to authenticated using (public.is_staff());
create policy "staff delete trucks"     on public.trucks     for delete to authenticated using (public.is_staff());
create policy "staff delete facilities" on public.facilities for delete to authenticated using (public.is_staff());
create policy "staff delete deliveries" on public.deliveries for delete to authenticated using (public.is_staff());
