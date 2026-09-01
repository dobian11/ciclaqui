CREATE OR REPLACE FUNCTION public.cancel_reward_redemption(_redemption_id uuid, _company_id uuid, _reason text DEFAULT NULL)
RETURNS public.reward_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _red public.reward_redemptions%ROWTYPE;
  _reward public.rewards_catalog%ROWTYPE;
BEGIN
  SELECT * INTO _red FROM public.reward_redemptions WHERE id = _redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Riscatto non trovato'; END IF;

  SELECT * INTO _reward FROM public.rewards_catalog WHERE id = _red.reward_id FOR UPDATE;
  IF NOT FOUND OR _reward.company_id IS DISTINCT FROM _company_id THEN
    RAISE EXCEPTION 'Riscatto non appartiene al tuo ente';
  END IF;

  IF _red.status = 'cancelled' THEN
    RETURN _red;
  END IF;

  -- Rimborso punti
  IF COALESCE(_red.points_spent, 0) > 0 THEN
    INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
    VALUES (_red.user_id, _red.points_spent, 0, 'redeem_cancelled:' || _red.id);

    UPDATE public.wallets
       SET points_balance = points_balance + _red.points_spent,
           updated_at = now()
     WHERE user_id = _red.user_id;
  END IF;

  -- Ripristino stock
  IF _reward.stock IS NOT NULL THEN
    UPDATE public.rewards_catalog SET stock = stock + 1 WHERE id = _reward.id;
  END IF;

  -- Chiusura richiesta di pagamento collegata (premi in denaro)
  UPDATE public.payout_requests
     SET status = 'rejected',
         admin_notes = COALESCE(admin_notes, '') || ' [Riscatto premio annullato dall''ente]',
         reviewed_at = now(),
         updated_at = now()
   WHERE id = (
     SELECT id FROM public.payout_requests
      WHERE user_id = _red.user_id
        AND status IN ('pending','approved')
        AND points_redeemed = _red.points_spent
      ORDER BY created_at DESC
      LIMIT 1
   );

  UPDATE public.reward_redemptions
     SET status = 'cancelled',
         used_at = NULL,
         cancel_reason = _reason
   WHERE id = _red.id
   RETURNING * INTO _red;

  RETURN _red;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_reward_redemption(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reward_redemption(uuid, uuid, text) TO service_role;