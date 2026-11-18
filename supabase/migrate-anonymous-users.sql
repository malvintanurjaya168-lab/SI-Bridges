-- Citizen privacy pass — run this ENTIRE file in Supabase SQL Editor.
-- It's self-contained: it fixes the prerequisites that cause
-- "Database error creating anonymous user" even if earlier migrations
-- were skipped.
--
--  1) profiles.email nullable (anonymous users have no email)
--  2) app_role enum contains 'user'
--  3) Legacy roles remapped to 'user'
--  4) Signup trigger names anonymous users UserAnonymous<N>
--  5) Existing anonymous profiles renamed the same way
--  6) Legacy role-test accounts deleted

-- ---------- 1) email nullable ----------
alter table public.profiles alter column email drop not null;

-- ---------- 2) ensure 'user' exists in app_role enum ----------
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'app_role' and e.enumlabel = 'user') then
    alter type public.app_role add value 'user';
  end if;
end $$;

-- ---------- 3) remap legacy roles ----------
update public.profiles set role = 'user'
where role::text in ('monitoring_operator', 'field_supervisor', 'analyst', 'viewer');

-- ---------- 4) sequence + signup trigger ----------
create sequence if not exists public.anon_user_seq;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_anon boolean := coalesce(new.email is null, false)
              or coalesce((new.raw_app_meta_data->>'is_anonymous')::boolean, false);
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    case
      when is_anon then 'UserAnonymous' || nextval('public.anon_user_seq')
      else coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), 'User')
    end,
    new.email,  -- null for anonymous users
    'user'::app_role
  );
  return new;
end $$;

-- ---------- 5) rename existing anonymous/guest profiles ----------
update public.profiles
set name = 'UserAnonymous' || nextval('public.anon_user_seq')
where (email is null or email = '')
  and name not like 'UserAnonymous%';

-- ---------- 6) delete legacy role-test accounts ----------
-- Removes auth.users rows; profiles cascade-delete automatically.
delete from auth.users
where email in (
  'operator@gmail.com',
  'supervisor@gmail.com',
  'analyst@gmail.com',
  'viewer@gmail.com'
);

-- ---------- 7) reload API schema cache ----------
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;

comment on sequence public.anon_user_seq is 'Generates UserAnonymous<N> names for citizen/guest accounts';
comment on table public.profiles is 'User profiles; anonymous citizens appear as UserAnonymous<N> with null email';
