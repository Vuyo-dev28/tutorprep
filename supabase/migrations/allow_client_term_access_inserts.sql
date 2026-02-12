-- Allow users to insert their own term access and payment records (client-side payments)
drop policy if exists "Users can insert own term access" on public.past_paper_term_access;
create policy "Users can insert own term access"
  on public.past_paper_term_access
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own payments" on public.past_paper_payments;
create policy "Users can insert own payments"
  on public.past_paper_payments
  for insert
  with check (auth.uid() = user_id);
