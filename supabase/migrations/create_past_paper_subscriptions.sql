-- Monthly subscription for full past papers access (one row per user)
create table if not exists public.past_paper_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  current_period_end timestamptz not null,
  curriculum text check (curriculum in ('CAPS', 'IEB')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.past_paper_subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.past_paper_subscriptions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscription"
  on public.past_paper_subscriptions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subscription"
  on public.past_paper_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
