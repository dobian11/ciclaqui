-- ============================================
-- 1. APPROVAZIONE ENTI (companies.status)
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.company_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status public.company_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Enti già esistenti li consideriamo approvati per non rompere il flusso
UPDATE public.companies SET status = 'approved', approved_at = now() WHERE status = 'pending';

-- ============================================
-- 2. CHALLENGES
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.challenge_type AS ENUM ('km_bike', 'km_foot', 'streak_days', 'trip_count', 'co2_saved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.challenge_period AS ENUM ('weekly', 'monthly', 'one_off');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type public.challenge_type NOT NULL,
  period public.challenge_period NOT NULL DEFAULT 'weekly',
  goal numeric NOT NULL CHECK (goal > 0),
  reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  icon text DEFAULT 'trophy',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_company ON public.challenges(company_id);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges(is_active, ends_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View global or own-company challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Managers create own-company challenges"
  ON public.challenges FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
     AND public.has_role(auth.uid(), 'company_manager'))
    OR (company_id IS NULL AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Managers update own-company challenges"
  ON public.challenges FOR UPDATE TO authenticated
  USING (
    (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
     AND public.has_role(auth.uid(), 'company_manager'))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Managers delete own-company challenges"
  ON public.challenges FOR DELETE TO authenticated
  USING (
    (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
     AND public.has_role(auth.uid(), 'company_manager'))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. USER_CHALLENGES (progresso)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress numeric NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user ON public.user_challenges(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_challenges TO authenticated;
GRANT ALL ON public.user_challenges TO service_role;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenge progress"
  ON public.user_challenges FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view company progress"
  ON public.user_challenges FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'company_manager')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_challenges.user_id
        AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE TRIGGER trg_user_challenges_updated_at
  BEFORE UPDATE ON public.user_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. STREAKS
-- ============================================
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_days integer NOT NULL DEFAULT 0 CHECK (current_days >= 0),
  best_days integer NOT NULL DEFAULT 0 CHECK (best_days >= 0),
  last_active_date date,
  multiplier numeric NOT NULL DEFAULT 1.0 CHECK (multiplier >= 1.0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.streaks TO authenticated;
GRANT ALL ON public.streaks TO service_role;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own streak"
  ON public.streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own streak"
  ON public.streaks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own streak"
  ON public.streaks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_streaks_updated_at
  BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. BADGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'award',
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_badges_user ON public.badges(user_id);

GRANT SELECT, INSERT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own badges"
  ON public.badges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own badges"
  ON public.badges FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view company badges"
  ON public.badges FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'company_manager')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = badges.user_id
        AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins view all badges"
  ON public.badges FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));