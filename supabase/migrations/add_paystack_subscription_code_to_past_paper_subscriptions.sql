-- Store Paystack subscription code for recurring subscriptions (Subscriptions API)
alter table if exists public.past_paper_subscriptions
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_customer_code text;

comment on column public.past_paper_subscriptions.paystack_subscription_code is 'Paystack subscription code (SUB_xxx) when using Subscriptions API';
comment on column public.past_paper_subscriptions.paystack_customer_code is 'Paystack customer code (CUS_xxx) when using Subscriptions API';
