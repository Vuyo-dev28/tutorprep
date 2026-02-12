-- Add visibility control for past papers and subjects
alter table if exists public.past_papers
  add column if not exists is_visible boolean not null default true;

create table if not exists public.past_paper_subject_visibility (
  id uuid primary key default uuid_generate_v4(),
  subject text not null,
  curriculum text not null check (curriculum in ('CAPS', 'IEB')),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject, curriculum)
);

alter table public.past_paper_subject_visibility enable row level security;

create policy "Admins can manage past paper subject visibility"
  on public.past_paper_subject_visibility
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Users can view past paper subject visibility"
  on public.past_paper_subject_visibility
  for select
  using (true);
