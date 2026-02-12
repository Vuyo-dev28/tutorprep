-- Create past_papers table
create table if not exists public.past_papers (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subject text not null,
  grade integer not null,
  curriculum text not null check (curriculum in ('CAPS', 'IEB')),
  term integer not null check (term in (1, 2, 3, 4)),
  year integer not null,
  exam_type text,
  file_url text not null,
  file_name text not null,
  file_size bigint,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.past_papers enable row level security;

-- Admins can do everything with past papers
create policy "Admins can manage past papers"
  on public.past_papers
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Users can view past papers
create policy "Users can view past papers"
  on public.past_papers
  for select
  using (true);

-- Create indexes
create index if not exists past_papers_subject_idx on public.past_papers(subject);
create index if not exists past_papers_grade_idx on public.past_papers(grade);
create index if not exists past_papers_curriculum_idx on public.past_papers(curriculum);
create index if not exists past_papers_term_idx on public.past_papers(term);
create index if not exists past_papers_year_idx on public.past_papers(year);
create index if not exists past_papers_created_at_idx on public.past_papers(created_at desc);

-- Create storage bucket for past papers
insert into storage.buckets (id, name, public)
values ('past-papers', 'past-papers', false)
on conflict (id) do nothing;

-- Storage policies for past papers
-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Admins can upload past papers" on storage.objects;
drop policy if exists "Admins can manage past papers files" on storage.objects;
drop policy if exists "Users can view past papers files" on storage.objects;

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
