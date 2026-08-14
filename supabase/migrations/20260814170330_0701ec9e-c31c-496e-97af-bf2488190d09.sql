-- badges: no self-insert
DROP POLICY IF EXISTS "Users insert own badges" ON public.badges;

-- streaks: server-managed only (bump_streak is SECURITY DEFINER)
DROP POLICY IF EXISTS "Users insert own streak" ON public.streaks;
DROP POLICY IF EXISTS "Users update own streak" ON public.streaks;

-- user_challenges: read-only for the owner
DROP POLICY IF EXISTS "Users manage own challenge progress" ON public.user_challenges;
CREATE POLICY "Users view own challenge progress"
  ON public.user_challenges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- wallets: inserts must start at zero balances
DROP POLICY IF EXISTS "users insert own wallet" ON public.wallets;
CREATE POLICY "users insert own wallet"
  ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND points_balance = 0
    AND eur_balance = 0
    AND lifetime_points = 0
    AND lifetime_km = 0
  );

-- revoke direct write grants where policies no longer allow them
REVOKE INSERT ON public.badges FROM authenticated;
REVOKE INSERT, UPDATE ON public.streaks FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_challenges FROM authenticated;