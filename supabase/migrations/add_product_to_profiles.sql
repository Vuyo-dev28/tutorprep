-- Add product column to profiles table
-- Product can be 'TUTOR' or 'PAST PAPERS'
alter table public.profiles
  add column if not exists product text check (product in ('TUTOR', 'PAST PAPERS'));

-- Create index for faster lookups
create index if not exists profiles_product_idx on public.profiles(product) where product is not null;
