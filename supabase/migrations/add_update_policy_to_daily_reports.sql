-- Add update policy for daily_reports to allow upsert operations
create policy "Daily reports are updatable by owner"
  on public.daily_reports
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
