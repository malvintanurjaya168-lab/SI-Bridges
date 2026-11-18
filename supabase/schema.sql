-- ============================================================
-- SI BRIDGES — Supabase schema (PostgreSQL)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ---------- ENUMS ----------
create type severity as enum ('high', 'moderate', 'low');
create type waste_status as enum ('new', 'verified', 'assigned', 'resolved', 'rejected');
create type task_status as enum ('pending', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled');
create type task_priority as enum ('critical', 'high', 'medium', 'low');
create type truck_status as enum ('active', 'idle', 'offline', 'maintenance');
create type facility_type as enum ('TPS', 'TPST', 'TPA');
create type facility_status as enum ('operational', 'near_capacity', 'full', 'maintenance');
create type delivery_status as enum ('completed', 'in_transit', 'scheduled');
create type alert_severity as enum ('critical', 'warning', 'info');
create type alert_status as enum ('open', 'acknowledged', 'resolved');
create type detection_source as enum ('truck_camera', 'cctv', 'citizen_report', 'manual', 'live_camera');
create type flood_risk as enum ('low', 'moderate', 'high', 'insufficient');
create type app_role as enum ('admin', 'truck_operator', 'user');

-- ---------- PROFILES (extends auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- WASTE DETECTIONS ----------
create table public.detections (
  id text primary key,                    -- e.g. DET-0001
  location text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  severity severity not null,
  confidence int not null check (confidence between 0 and 100),
  ai_class text,
  status waste_status not null default 'new',
  source detection_source not null default 'manual',
  observations text[] default '{}',
  recommended_action text,
  image_label text,
  image_url text,                         -- Supabase Storage path (optional)
  detected_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_detections_geo on public.detections (lat, lng);
create index idx_detections_status on public.detections (status);
create index idx_detections_time on public.detections (detected_at desc);
create index idx_detections_severity on public.detections (severity);

-- ---------- TRUCKS ----------
create table public.trucks (
  id text primary key,                    -- e.g. TRK-001
  plate text not null unique,
  name text not null,
  status truck_status not null default 'idle',
  lat double precision not null,
  lng double precision not null,
  route_id text,
  route_name text,
  driver text,
  team text,
  last_update timestamptz not null default now(),
  capacity_kg int not null default 8000,
  load_kg int not null default 0,
  waypoints jsonb default '[]'::jsonb,     -- [{lat,lng}...] for route display
  wp_index int not null default 0,
  speed_kmh int not null default 20,
  created_at timestamptz not null default now()
);
create index idx_trucks_status on public.trucks (status);

-- ---------- CLEANING TASKS ----------
create table public.cleaning_tasks (
  id text primary key,                    -- e.g. TSK-0001
  title text not null,
  location text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  priority task_priority not null default 'medium',
  status task_status not null default 'pending',
  detection_id text references public.detections(id) on delete set null,
  truck_id text references public.trucks(id) on delete set null,
  team text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  evidence_url text,                      -- completion photo (Storage)
  evidence_uploaded boolean not null default false,
  verified boolean not null default false,
  verified_by uuid references public.profiles(id)
);
create index idx_tasks_status on public.cleaning_tasks (status);
create index idx_tasks_detection on public.cleaning_tasks (detection_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_tasks_touch
  before update on public.cleaning_tasks
  for each row execute function public.touch_updated_at();

-- ---------- FACILITIES ----------
create table public.facilities (
  id text primary key,                    -- e.g. FAC-001
  name text not null,
  type facility_type not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  capacity_tons numeric not null default 0,
  current_load_tons numeric not null default 0,
  operator text,
  status facility_status not null default 'operational',
  open_hours text,
  created_at timestamptz not null default now()
);
create index idx_facilities_type on public.facilities (type);

-- ---------- DELIVERIES ----------
create table public.deliveries (
  id text primary key,                    -- e.g. DLV-0001
  truck_id text not null references public.trucks(id) on delete cascade,
  facility_id text not null references public.facilities(id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0),
  timestamp timestamptz not null default now(),
  status delivery_status not null default 'completed',
  notes text,
  created_at timestamptz not null default now()
);
create index idx_deliveries_time on public.deliveries (timestamp desc);
create index idx_deliveries_truck on public.deliveries (truck_id);

-- ---------- ALERTS ----------
create table public.alerts (
  id text primary key,                    -- e.g. ALT-0001
  type text not null,                     -- high_waste, offline_truck, facility_capacity, ...
  severity alert_severity not null default 'info',
  title text not null,
  message text,
  related_id text,                        -- detection/task/truck/facility id
  status alert_status not null default 'open',
  acknowledged_by uuid references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_alerts_status on public.alerts (status);
create index idx_alerts_created on public.alerts (created_at desc);

-- ---------- FLOOD ZONES ----------
create table public.flood_zones (
  id text primary key,                    -- e.g. FLD-1
  name text not null,
  district text,
  lat double precision not null,
  lng double precision not null,
  risk flood_risk not null default 'insufficient',
  score int not null default 0 check (score between 0 and 100),
  factors jsonb default '[]'::jsonb,      -- [{label, value, impact}]
  recommendations text[] default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles       enable row level security;
alter table public.detections     enable row level security;
alter table public.trucks         enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.facilities     enable row level security;
alter table public.deliveries     enable row level security;
alter table public.alerts         enable row level security;
alter table public.flood_zones    enable row level security;

-- Helper: is the current user staff (any non-viewer role)?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'truck_operator')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Read: any authenticated user
create policy "auth read profiles"   on public.profiles       for select to authenticated using (true);
create policy "auth read detections" on public.detections     for select to authenticated using (true);
create policy "auth read trucks"     on public.trucks         for select to authenticated using (true);
create policy "auth read tasks"      on public.cleaning_tasks for select to authenticated using (true);
create policy "auth read facilities" on public.facilities     for select to authenticated using (true);
create policy "auth read deliveries" on public.deliveries     for select to authenticated using (true);
create policy "auth read alerts"     on public.alerts         for select to authenticated using (true);
create policy "auth read flood"      on public.flood_zones    for select to authenticated using (true);

-- Write: staff only (viewers read-only)
create policy "staff insert detections" on public.detections for insert to authenticated with check (public.is_staff());
create policy "staff update detections" on public.detections for update to authenticated using (public.is_staff());

create policy "staff update trucks" on public.trucks for update to authenticated using (public.is_staff());
create policy "staff insert trucks" on public.trucks for insert to authenticated with check (public.is_staff());

create policy "staff all tasks" on public.cleaning_tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "staff update facilities" on public.facilities for update to authenticated using (public.is_staff());
create policy "staff insert facilities" on public.facilities for insert to authenticated with check (public.is_staff());

create policy "staff insert deliveries" on public.deliveries for insert to authenticated with check (public.is_staff());
create policy "staff all deliveries"   on public.deliveries for update to authenticated using (public.is_staff());

create policy "staff all alerts" on public.alerts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "staff all flood" on public.flood_zones for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Admin-only: manage users/roles
create policy "admin update profiles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin delete profiles" on public.profiles for delete to authenticated
  using (public.is_admin());
create policy "users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.detections;
alter publication supabase_realtime add table public.trucks;
alter publication supabase_realtime add table public.cleaning_tasks;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.deliveries;

-- ---------- STORAGE (optional: evidence photos) ----------
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy "staff upload evidence" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_staff());
create policy "auth read evidence" on storage.objects for select to authenticated
  using (bucket_id = 'evidence');
