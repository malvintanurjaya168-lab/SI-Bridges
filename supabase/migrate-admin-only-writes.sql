-- Tighten write access: admin is the only role that can manage
-- facilities, deliveries, and alerts. Truck operators keep write access
-- to detections (review), tasks, and trucks (their job functions).
-- Run in Supabase SQL Editor.

-- Facilities: admin-only writes
drop policy if exists "staff update facilities" on public.facilities;
drop policy if exists "staff insert facilities" on public.facilities;
create policy "admin update facilities" on public.facilities for update to authenticated using (public.is_admin());
create policy "admin insert facilities" on public.facilities for insert to authenticated with check (public.is_admin());

-- Deliveries: admin-only writes
drop policy if exists "staff insert deliveries" on public.deliveries;
drop policy if exists "staff all deliveries" on public.deliveries;
create policy "admin insert deliveries" on public.deliveries for insert to authenticated with check (public.is_admin());
create policy "admin update deliveries" on public.deliveries for update to authenticated using (public.is_admin());

-- Alerts: admin-only writes
drop policy if exists "staff all alerts" on public.alerts;
create policy "admin all alerts" on public.alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Detections/tasks/trucks stay staff-writable (operator job functions).
-- NOTE: run migrate-review.sql / migrate-crud.sql policies are compatible;
-- they use is_staff() which still covers admin + truck_operator for those tables.

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
