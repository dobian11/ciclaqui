ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS inapp_reward_threshold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_reward_threshold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_reward_threshold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inapp_reward_confirm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_reward_confirm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_reward_confirm boolean NOT NULL DEFAULT true;

ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS cancel_reason text;