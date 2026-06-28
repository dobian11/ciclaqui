
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('user', 'company_manager', 'admin');
CREATE TYPE public.bike_status AS ENUM ('libera', 'custodita', 'rubata', 'recuperata');
CREATE TYPE public.trip_mode AS ENUM ('foot', 'bike', 'car');
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'inactive');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'pro', 'enterprise');
CREATE TYPE public.bike_report_type AS ENUM ('sighting', 'recovery');

-- ============================================================
-- updated_at helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- companies
-- ============================================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vat text,
  code text NOT NULL UNIQUE,
  iban text,
  contact_email text NOT NULL,
  stripe_customer_id text,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  plan public.subscription_plan NOT NULL DEFAULT 'starter',
  employee_cap integer NOT NULL DEFAULT 20,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT ON public.companies TO anon; -- per validare codice azienda al signup
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  weight_kg numeric(5,2) DEFAULT 70,
  avatar_url text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_profiles_company ON public.profiles(company_id);

-- ============================================================
-- user_roles
-- ============================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (anti-recursion in RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- handle_new_user trigger: create profile + assign 'user' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_code text;
  _company_id uuid;
  _signup_kind text;
BEGIN
  _signup_kind := COALESCE(NEW.raw_user_meta_data->>'signup_kind', 'user');
  _company_code := NEW.raw_user_meta_data->>'company_code';

  IF _company_code IS NOT NULL AND length(_company_code) > 0 THEN
    SELECT id INTO _company_id FROM public.companies WHERE code = upper(_company_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    _company_id
  );

  IF _signup_kind = 'company_manager' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'company_manager');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  -- create wallet
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- ============================================================
-- wallets (must exist before handle_new_user runs)
-- ============================================================
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0,
  eur_balance numeric(10,2) NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  lifetime_km numeric(10,2) NOT NULL DEFAULT 0,
  stripe_account_id text,
  stripe_onboarding_complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Now register the auth.users trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- bikes
-- ============================================================
CREATE TABLE public.bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marca text NOT NULL,
  modello text,
  colore text,
  frame_number text NOT NULL,
  photo_url text,
  receipt_url text,
  status public.bike_status NOT NULL DEFAULT 'libera',
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  stolen_at timestamptz,
  stolen_lat numeric(10,7),
  stolen_lng numeric(10,7),
  stolen_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bikes TO authenticated;
GRANT ALL ON public.bikes TO service_role;
GRANT SELECT ON public.bikes TO anon; -- lookup pubblico per numero telaio
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_bikes_frame_number_unique ON public.bikes(lower(frame_number));
CREATE INDEX idx_bikes_owner ON public.bikes(owner_id);
CREATE INDEX idx_bikes_qr_token ON public.bikes(qr_token);
CREATE INDEX idx_bikes_status ON public.bikes(status) WHERE status = 'rubata';
CREATE TRIGGER update_bikes_updated_at BEFORE UPDATE ON public.bikes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- bike_reports
-- ============================================================
CREATE TABLE public.bike_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.bike_report_type NOT NULL,
  lat numeric(10,7),
  lng numeric(10,7),
  note text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bike_reports TO authenticated;
GRANT INSERT ON public.bike_reports TO anon; -- segnalazione anche da utenti non loggati
GRANT ALL ON public.bike_reports TO service_role;
ALTER TABLE public.bike_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bike_reports_bike ON public.bike_reports(bike_id);

-- ============================================================
-- trips
-- ============================================================
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  mode public.trip_mode NOT NULL,
  distance_km numeric(8,3) NOT NULL DEFAULT 0,
  avg_speed_kmh numeric(6,2) NOT NULL DEFAULT 0,
  max_speed_kmh numeric(6,2) NOT NULL DEFAULT 0,
  calories integer NOT NULL DEFAULT 0,
  co2_saved_kg numeric(8,3) NOT NULL DEFAULT 0,
  path jsonb,
  points_earned integer NOT NULL DEFAULT 0,
  anomaly_flag boolean NOT NULL DEFAULT false,
  anomaly_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_trips_user ON public.trips(user_id, started_at DESC);

-- ============================================================
-- point_transactions
-- ============================================================
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta_points integer NOT NULL,
  delta_eur numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_point_tx_user ON public.point_transactions(user_id, created_at DESC);

-- ============================================================
-- payout_requests
-- ============================================================
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_eur numeric(10,2) NOT NULL,
  points_redeemed integer NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'pending',
  stripe_payout_id text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payouts_user ON public.payout_requests(user_id, created_at DESC);
CREATE INDEX idx_payouts_status ON public.payout_requests(status);

-- ============================================================
-- company_subscriptions
-- ============================================================
CREATE TABLE public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  status public.subscription_status NOT NULL DEFAULT 'inactive',
  plan public.subscription_plan NOT NULL DEFAULT 'starter',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_company_subs_updated_at BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_subs_company ON public.company_subscriptions(company_id);

-- ============================================================
-- app_config (singleton)
-- ============================================================
CREATE TABLE public.app_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  points_per_km_bike integer NOT NULL DEFAULT 10,
  points_per_km_foot integer NOT NULL DEFAULT 3,
  points_per_km_car integer NOT NULL DEFAULT 0,
  daily_cap_km numeric(6,2) NOT NULL DEFAULT 50,
  payout_threshold_eur numeric(10,2) NOT NULL DEFAULT 5,
  eur_per_point numeric(10,4) NOT NULL DEFAULT 0.01,
  speed_threshold_foot_kmh numeric(5,2) NOT NULL DEFAULT 8,
  speed_threshold_bike_kmh numeric(5,2) NOT NULL DEFAULT 35,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO authenticated, anon;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_config (id) VALUES (1);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- companies
CREATE POLICY "anyone can read companies (for code validation)" ON public.companies
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "company managers update their own company" ON public.companies
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete companies" ON public.companies
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "managers read employees" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'company_manager')
    AND company_id IN (SELECT id FROM public.companies WHERE created_by = auth.uid())
  );
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "admins all on profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- wallets
CREATE POLICY "users read own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own wallet stripe fields" ON public.wallets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "managers read employee wallets" ON public.wallets
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'company_manager')
    AND user_id IN (
      SELECT p.id FROM public.profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE c.created_by = auth.uid()
    )
  );

-- bikes
CREATE POLICY "owners read own bikes" ON public.bikes
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "public lookup stolen bikes" ON public.bikes
  FOR SELECT TO anon, authenticated USING (status = 'rubata');
CREATE POLICY "owners insert bikes" ON public.bikes
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owners update own bikes" ON public.bikes
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owners delete own bikes" ON public.bikes
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- bike_reports
CREATE POLICY "owners read reports on own bikes" ON public.bike_reports
  FOR SELECT TO authenticated USING (
    bike_id IN (SELECT id FROM public.bikes WHERE owner_id = auth.uid())
    OR reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "anyone can create report on stolen bike" ON public.bike_reports
  FOR INSERT TO anon, authenticated WITH CHECK (
    bike_id IN (SELECT id FROM public.bikes WHERE status = 'rubata')
  );

-- trips
CREATE POLICY "users read own trips" ON public.trips
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "managers read employee trips" ON public.trips
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'company_manager')
    AND user_id IN (
      SELECT p.id FROM public.profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE c.created_by = auth.uid()
    )
  );
-- trips are inserted by server functions only; client INSERT denied implicitly (no policy)

-- point_transactions: read-only for users (server-managed)
CREATE POLICY "users read own point tx" ON public.point_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- payout_requests
CREATE POLICY "users read own payouts" ON public.payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own payouts" ON public.payout_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage payouts" ON public.payout_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- company_subscriptions
CREATE POLICY "managers read own company sub" ON public.company_subscriptions
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT id FROM public.companies WHERE created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- app_config
CREATE POLICY "anyone read config" ON public.app_config
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins update config" ON public.app_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Helper: generate unique short company code (e.g. ACME-7F2K)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_company_code(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
  _suffix text;
  _candidate text;
  _attempts int := 0;
BEGIN
  _prefix := upper(regexp_replace(coalesce(_name,'CO'), '[^A-Za-z0-9]', '', 'g'));
  _prefix := substring(_prefix from 1 for 4);
  IF length(_prefix) = 0 THEN _prefix := 'CO'; END IF;

  LOOP
    _suffix := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));
    _candidate := _prefix || '-' || _suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE code = _candidate);
    _attempts := _attempts + 1;
    IF _attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique company code'; END IF;
  END LOOP;

  RETURN _candidate;
END;
$$;
