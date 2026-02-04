-- Create daily_reports table
create table if not exists public.daily_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  struggling_topics jsonb not null,
  needs_work jsonb not null,
  recommendations text,
  overall_performance text,
  created_at timestamptz not null default now(),
  unique (user_id, report_date)
);

alter table public.daily_reports enable row level security;

create policy "Daily reports are viewable by owner"
  on public.daily_reports
  for select
  using (auth.uid() = user_id);

create policy "Daily reports are insertable by owner"
  on public.daily_reports
  for insert
  with check (auth.uid() = user_id);

create policy "Daily reports are updatable by owner"
  on public.daily_reports
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
