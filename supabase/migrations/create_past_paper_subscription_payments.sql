-- Record subscription payments (same pattern as past_paper_payments for term purchases)
create table if not exists public.past_paper_subscription_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  curriculum text not null check (curriculum in ('CAPS', 'IEB')),
  reference text unique not null,
  amount integer not null,
  currency text not null default 'ZAR',
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.past_paper_subscription_payments enable row level security;

create policy "Users can view own subscription payments"
  on public.past_paper_subscription_payments
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscription payments"
  on public.past_paper_subscription_payments
  for insert
  with check (auth.uid() = user_id);
