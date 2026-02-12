-- Past paper subjects (admin-managed list for upload/edit dropdowns and dashboard)
create table if not exists public.past_paper_subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.past_paper_subjects enable row level security;

create policy "Anyone can read past paper subjects"
  on public.past_paper_subjects
  for select
  using (true);

create policy "Admins can manage past paper subjects"
  on public.past_paper_subjects
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Seed default subjects
insert into public.past_paper_subjects (name, sort_order)
values
  ('Mathematics', 0),
  ('Physical Sciences', 1)
on conflict (name) do nothing;
