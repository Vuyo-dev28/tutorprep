-- Create contact_submissions table for landing page contact form
create table if not exists public.contact_submissions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Only admins can view contact submissions
create policy "Admins can view contact submissions"
  on public.contact_submissions
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Anyone can insert contact submissions (for the public contact form)
create policy "Anyone can submit contact form"
  on public.contact_submissions
  for insert
  with check (true);

-- Only admins can update contact submissions
create policy "Admins can update contact submissions"
  on public.contact_submissions
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Create index for faster queries
create index if not exists contact_submissions_status_idx on public.contact_submissions(status);
create index if not exists contact_submissions_created_at_idx on public.contact_submissions(created_at desc);
