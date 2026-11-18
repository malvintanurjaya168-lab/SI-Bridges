-- Allow any authenticated user (including guests / role 'user') to submit
-- citizen waste reports. They can ONLY insert detections with
-- source='citizen_report' and status='new' — everything else still requires
-- is_staff(). Reports then go through the normal human review gate.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections'
      and policyname = 'citizen insert reports'
  ) then
    create policy "citizen insert reports" on public.detections
      for insert to authenticated
      with check (source = 'citizen_report' and status = 'new');
  end if;
end $$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
