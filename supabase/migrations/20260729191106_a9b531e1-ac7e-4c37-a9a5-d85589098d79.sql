ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS inapp_streak boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_challenges boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_bike boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_trip_flag boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_rewards boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_company boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_streak boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_challenges boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_bike boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_trip_flag boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_rewards boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_company boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_product boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;