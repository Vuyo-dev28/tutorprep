-- Ensure past-papers storage bucket exists
-- This migration ensures the bucket is created even if the main migration failed

-- Create storage bucket for past papers
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'past-papers', 
  'past-papers', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do update
set 
  name = 'past-papers',
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Admins can upload past papers" on storage.objects;
drop policy if exists "Admins can manage past papers files" on storage.objects;
drop policy if exists "Users can view past papers files" on storage.objects;

-- Storage policies for past papers
create policy "Admins can upload past papers"
  on storage.objects
  for insert
  with check (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage past papers files"
  on storage.objects
  for all
  using (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Users can view past papers (but not download - this will be handled by signed URLs)
create policy "Users can view past papers files"
  on storage.objects
  for select
  using (
    bucket_id = 'past-papers'
  );
