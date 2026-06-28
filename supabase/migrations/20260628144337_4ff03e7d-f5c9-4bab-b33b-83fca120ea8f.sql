
-- Cookie consents
CREATE TABLE public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  necessary boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  ip_hash text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cookie_consents TO authenticated;
GRANT INSERT ON public.cookie_consents TO anon;
GRANT ALL ON public.cookie_consents TO service_role;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own consent" ON public.cookie_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "anon inserts anonymous consent" ON public.cookie_consents FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "user reads own consent" ON public.cookie_consents FOR SELECT TO authenticated USING (user_id = auth.uid());

-- GDPR data export requests
CREATE TABLE public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending|ready|failed
  file_path text,
  error text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  expires_at timestamptz
);
GRANT SELECT, INSERT ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own exports" ON public.data_export_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user creates own export" ON public.data_export_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Account deletion
CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  scheduled_for timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own deletion" ON public.account_deletion_requests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Device tokens for push
CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL, -- ios|android|web
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own tokens" ON public.device_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_streak boolean NOT NULL DEFAULT true,
  push_challenges boolean NOT NULL DEFAULT true,
  push_bike boolean NOT NULL DEFAULT true,
  push_trip_flag boolean NOT NULL DEFAULT true,
  push_rewards boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own prefs" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trip flags (anti-frode)
CREATE TABLE public.trip_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  score numeric NOT NULL,
  declared_mode text NOT NULL,
  predicted_mode text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trip_flags TO authenticated;
GRANT ALL ON public.trip_flags TO service_role;
ALTER TABLE public.trip_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own flags" ON public.trip_flags FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = trip_flags.company_id AND public.has_role(auth.uid(),'company_manager'))));
CREATE POLICY "manager updates flags" ON public.trip_flags FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR (company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = trip_flags.company_id AND public.has_role(auth.uid(),'company_manager'))));

-- Rewards catalog (centrale Cicla Qui)
CREATE TABLE public.rewards_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  partner text,
  category text NOT NULL DEFAULT 'voucher', -- voucher|cash|donation|service
  points_cost integer NOT NULL CHECK (points_cost > 0),
  cash_value_eur numeric DEFAULT 0,
  image_url text,
  stock integer, -- null = illimitato
  region text, -- null = nazionale
  terms text,
  active boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'national', -- national|local
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards_catalog TO authenticated, anon;
GRANT ALL ON public.rewards_catalog TO service_role;
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads active rewards" ON public.rewards_catalog FOR SELECT USING (active = true);
CREATE POLICY "admin manages all rewards" ON public.rewards_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "manager manages own local rewards" ON public.rewards_catalog FOR ALL TO authenticated
  USING (scope='local' AND company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.company_id=rewards_catalog.company_id AND public.has_role(auth.uid(),'company_manager')))
  WITH CHECK (scope='local' AND company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.company_id=rewards_catalog.company_id AND public.has_role(auth.uid(),'company_manager')));

-- Reward redemptions
CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'active', -- active|used|expired|refunded
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own redemptions" ON public.reward_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user creates own redemption" ON public.reward_redemptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER trg_rewards_catalog_updated BEFORE UPDATE ON public.rewards_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX idx_trip_flags_company_status ON public.trip_flags(company_id, status);
CREATE INDEX idx_redemptions_user ON public.reward_redemptions(user_id);
CREATE INDEX idx_rewards_scope_active ON public.rewards_catalog(scope, active);
