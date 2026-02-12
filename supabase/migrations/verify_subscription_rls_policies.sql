-- Verify RLS policies for subscription tables
-- These policies should already exist, but this ensures they're correct

-- For past_paper_subscription_payments
-- Drop and recreate to ensure they're correct
DROP POLICY IF EXISTS "Users can insert own subscription payments" ON public.past_paper_subscription_payments;
CREATE POLICY "Users can insert own subscription payments"
  ON public.past_paper_subscription_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- For past_paper_subscriptions
-- Ensure insert policy exists
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.past_paper_subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON public.past_paper_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);coalesce(expression, ...)

-- Ensure update policy exists (for upsert)
DROP POLICY IF EXISTS "Users can update own subscription" ON public.past_paper_subscriptions;
CREATE POLICY "Users can update own subscription"
  ON public.past_paper_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
