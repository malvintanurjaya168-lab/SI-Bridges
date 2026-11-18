-- Storage bucket for citizen report photos.
-- Public read (staff need to view evidence); any authenticated user may upload.

insert into storage.buckets (id, name, public)
values ('detection-images', 'detection-images', true)
on conflict (id) do nothing;

-- Anyone signed in (incl. anonymous citizens) can upload report photos
drop policy if exists "auth upload detection images" on storage.objects;
create policy "auth upload detection images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'detection-images');

-- Public read so staff UI can display <img> without signed URLs
drop policy if exists "public read detection images" on storage.objects;
create policy "public read detection images" on storage.objects
  for select using (bucket_id = 'detection-images');
