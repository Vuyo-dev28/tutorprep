-- Store subscription details from Paystack when plan-based payments are used
alter table if exists public.past_paper_payments
  add column if not exists subscription_code text,
  add column if not exists customer_code text,
  add column if not exists authorization_code text;
