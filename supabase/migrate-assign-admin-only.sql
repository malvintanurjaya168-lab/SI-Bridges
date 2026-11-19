-- Hard enforcement: only admin may change truck assignment on cleaning_tasks.
-- UI hides assign controls for truck_operator, but this trigger blocks
-- direct API writes too. Status/notes/evidence updates by staff still work.

create or replace function public.enforce_admin_dispatch()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.truck_id is distinct from old.truck_id
      or new.team is distinct from old.team)
     and not public.is_admin() then
    raise exception 'Only admin can assign trucks to cleaning tasks';
  end if;
  return new;
end $$;

drop trigger if exists cleaning_tasks_admin_dispatch on public.cleaning_tasks;
create trigger cleaning_tasks_admin_dispatch
  before update on public.cleaning_tasks
  for each row execute function public.enforce_admin_dispatch();

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
