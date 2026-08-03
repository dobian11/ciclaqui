GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_company(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Managers create own-company challenges" ON public.challenges;
DROP POLICY IF EXISTS "Managers update own-company challenges" ON public.challenges;
DROP POLICY IF EXISTS "Managers delete own-company challenges" ON public.challenges;

CREATE POLICY "Managers create owned-company challenges"
ON public.challenges FOR INSERT TO authenticated
WITH CHECK (
  (company_id IS NOT NULL AND public.owns_company(company_id) AND public.has_role(auth.uid(), 'company_manager'))
  OR (company_id IS NULL AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Managers update owned-company challenges"
ON public.challenges FOR UPDATE TO authenticated
USING (
  (company_id IS NOT NULL AND public.owns_company(company_id) AND public.has_role(auth.uid(), 'company_manager'))
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (company_id IS NOT NULL AND public.owns_company(company_id) AND public.has_role(auth.uid(), 'company_manager'))
  OR (company_id IS NULL AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Managers delete owned-company challenges"
ON public.challenges FOR DELETE TO authenticated
USING (
  (company_id IS NOT NULL AND public.owns_company(company_id) AND public.has_role(auth.uid(), 'company_manager'))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "user creates own redemption" ON public.reward_redemptions;
REVOKE INSERT ON public.reward_redemptions FROM authenticated;

CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS public.reward_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _reward public.rewards_catalog%ROWTYPE;
  _wallet public.wallets%ROWTYPE;
  _user_company uuid;
  _redemption public.reward_redemptions%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta'; END IF;

  SELECT * INTO _reward FROM public.rewards_catalog WHERE id = _reward_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio non disponibile'; END IF;

  SELECT company_id INTO _user_company FROM public.profiles WHERE id = _uid;
  IF _reward.company_id IS NOT NULL AND _reward.company_id IS DISTINCT FROM _user_company THEN
    RAISE EXCEPTION 'Premio non disponibile per il tuo ente';
  END IF;
  IF _reward.stock IS NOT NULL AND _reward.stock <= 0 THEN RAISE EXCEPTION 'Premio esaurito'; END IF;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND OR _wallet.points_balance < _reward.points_cost THEN RAISE EXCEPTION 'Punti insufficienti'; END IF;

  UPDATE public.wallets SET points_balance = points_balance - _reward.points_cost WHERE user_id = _uid;
  IF _reward.stock IS NOT NULL THEN
    UPDATE public.rewards_catalog SET stock = stock - 1 WHERE id = _reward.id;
  END IF;

  INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
  VALUES (_uid, -_reward.points_cost, 0, 'redeem:' || _reward.id);

  INSERT INTO public.reward_redemptions(user_id, reward_id, code, points_spent, status)
  VALUES (_uid, _reward.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), _reward.points_cost, 'active')
  RETURNING * INTO _redemption;

  RETURN _redemption;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated, service_role;

REVOKE UPDATE ON public.wallets FROM authenticated;
GRANT UPDATE (stripe_account_id, stripe_onboarding_complete) ON public.wallets TO authenticated;