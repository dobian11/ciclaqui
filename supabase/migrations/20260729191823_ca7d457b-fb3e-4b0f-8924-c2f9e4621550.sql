ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_company boolean NOT NULL DEFAULT true;

ALTER TABLE public.company_email_log
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';