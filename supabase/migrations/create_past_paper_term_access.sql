-- Track paid access to past paper terms
create table if not exists public.past_paper_term_access (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_number integer not null check (term_number in (1, 2, 3, 4)),
  curriculum text not null check (curriculum in ('CAPS', 'IEB')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists past_paper_term_access_unique
  on public.past_paper_term_access(user_id, term_number, curriculum);

alter table public.past_paper_term_access enable row level security;

-- Users can view their own access
create policy "Users can view own term access"
  on public.past_paper_term_access
  for select
  using (auth.uid() = user_id);

-- Only service role should insert/update access (no client insert policy)

create table if not exists public.past_paper_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_number integer not null check (term_number in (1, 2, 3, 4)),
  curriculum text not null check (curriculum in ('CAPS', 'IEB')),
  reference text unique not null,
  amount integer not null,
  currency text not null default 'ZAR',
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.past_paper_payments enable row level security;

create policy "Users can view own payments"
  on public.past_paper_payments
  for select
  using (auth.uid() = user_id);
