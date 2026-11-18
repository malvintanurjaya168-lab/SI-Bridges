-- Citizen privacy pass:
--  1) Anonymous users get auto-generated names "UserAnonymous1", "UserAnonymous2", ...
--     (no email, no personal data stored or displayed)
--  2) Existing anonymous profiles are renamed the same way
--  3) Legacy test accounts with old roles are deleted entirely
--
-- Run in Supabase SQL Editor. Deletion is permanent — review before running.

-- ---------- 1) Sequence for anonymous names ----------
create sequence if not exists public.anon_user_seq;

-- ---------- 2) Update signup trigger ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    case
      when new.email is null
        then 'UserAnonymous' || nextval('public.anon_user_seq')
      else coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User')
    end,
    new.email,  -- null for anonymous users
    'user'::app_role
  );
  return new;
end $$;

-- ---------- 3) Rename existing anonymous/guest profiles ----------
-- (profiles with no real email = anonymous citizens)
update public.profiles
set name = 'UserAnonymous' || nextval('public.anon_user_seq')
where email is null or email = '';

-- ---------- 4) Delete legacy role-test accounts ----------
-- Removes auth.users rows; profiles cascade-delete automatically.
delete from auth.users
where email in (
  'operator@gmail.com',
  'supervisor@gmail.com',
  'analyst@gmail.com',
  'viewer@gmail.com'
);

-- ---------- 5) Reload API schema cache ----------
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;

comment on sequence public.anon_user_seq is 'Generates UserAnonymous<N> names for citizen/guest accounts';

