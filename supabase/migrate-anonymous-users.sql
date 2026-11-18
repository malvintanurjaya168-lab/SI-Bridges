-- Citizen privacy pass — run in TWO steps (see bottom).
--
-- STEP 1: Run ONLY this statement first, by itself:
--
--   alter type public.app_role add value if not exists 'user';
--
-- Postgres requires new enum values to be committed before use, so it
-- cannot share a transaction with the rest of this script.
--
-- STEP 2: Then run everything below.

-- ---------- 1) email nullable ----------
alter table public.profiles alter column email drop not null;

-- ---------- 2) remap legacy roles ----------
update public.profiles set role = 'user'
where role::text in ('monitoring_operator', 'field_supervisor', 'analyst', 'viewer');

-- ---------- 3) sequence + signup trigger ----------
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

-- ---------- 4) rename existing anonymous/guest profiles ----------
update public.profiles
set name = 'UserAnonymous' || nextval('public.anon_user_seq')
where (email is null or email = '')
  and name not like 'UserAnonymous%';

-- ---------- 5) delete legacy role-test accounts ----------
delete from auth.users
where email in (
  'operator@gmail.com',
  'supervisor@gmail.com',
  'analyst@gmail.com',
  'viewer@gmail.com'
);

-- ---------- 6) reload API schema cache ----------
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;

comment on sequence public.anon_user_seq is 'Generates UserAnonymous<N> names for citizen/guest accounts';
comment on table public.profiles is 'User profiles; anonymous citizens appear as UserAnonymous<N> with null email';
