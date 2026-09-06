ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan subscription_plan,
  ADD COLUMN IF NOT EXISTS pending_plan_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';

CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_stripe_sub_idx
  ON public.company_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;