-- ============================================================
-- SI BRIDGES — role model migration
-- Roles: admin | truck_operator | user (guest, anonymous)
-- Removed: monitoring_operator, field_supervisor, analyst, viewer
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Allow profiles without email (anonymous auth users have none)
alter table public.profiles alter column email drop not null;

-- 2) Recreate handle_new_user so anonymous sign-ups get a 'user' profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Guest'),
    coalesce(new.email, ''),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'user')
  );
  return new;
end $$;

-- 3) Swap the app_role enum: old values are remapped to 'user'
alter type public.app_role rename to app_role_old;
create type public.app_role as enum ('admin', 'truck_operator', 'user');

alter table public.profiles
  alter column role type public.app_role
  using (
    case role::text
      when 'admin' then 'admin'::public.app_role
      when 'truck_operator' then 'truck_operator'::public.app_role
      else 'user'::public.app_role
    end
  );

drop type public.app_role_old;

-- 4. Fix is_staff(): only admin and truck_operator may write.
--    ('user' guests must stay read-only — the old check role <> 'viewer'
--     would have wrongly made guests staff.)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'truck_operator')
  );
$$;
