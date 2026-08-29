CREATE OR REPLACE FUNCTION public.redeem_reward_for_user(_user_id uuid, _reward_id uuid)
 RETURNS reward_redemptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _reward public.rewards_catalog%ROWTYPE;
  _wallet public.wallets%ROWTYPE;
  _profile public.profiles%ROWTYPE;
  _redemption public.reward_redemptions%ROWTYPE;
  _open integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta'; END IF;

  SELECT * INTO _reward FROM public.rewards_catalog
  WHERE id = _reward_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio non disponibile'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _user_id;
  IF _reward.company_id IS NOT NULL AND _reward.company_id IS DISTINCT FROM _profile.company_id THEN
    RAISE EXCEPTION 'Premio non disponibile per il tuo ente';
  END IF;

  IF _reward.stock IS NOT NULL AND _reward.stock <= 0 THEN
    RAISE EXCEPTION 'Premio esaurito';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reward_redemptions r
     WHERE r.user_id = _user_id
       AND r.reward_id = _reward_id
       AND r.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Hai già riscattato questo premio';
  END IF;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND OR _wallet.points_balance < _reward.points_cost THEN RAISE EXCEPTION 'Punti insufficienti'; END IF;

  -- Premio in denaro: serve un IBAN e nessuna richiesta di pagamento in corso
  IF _reward.category = 'cash' AND COALESCE(_reward.cash_value_eur, 0) > 0 THEN
    IF _profile.iban IS NULL OR length(_profile.iban) < 15 THEN
      RAISE EXCEPTION 'Aggiungi il tuo IBAN nel profilo per riscattare un premio in denaro';
    END IF;
    SELECT count(*) INTO _open FROM public.payout_requests
     WHERE user_id = _user_id AND status IN ('pending','approved');
    IF _open > 0 THEN
      RAISE EXCEPTION 'Hai già una richiesta di pagamento in corso: attendi che venga completata';
    END IF;
  END IF;

  UPDATE public.wallets SET points_balance = points_balance - _reward.points_cost WHERE user_id = _user_id;
  IF _reward.stock IS NOT NULL THEN
    UPDATE public.rewards_catalog SET stock = stock - 1 WHERE id = _reward.id;
  END IF;

  INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
  VALUES (_user_id, -_reward.points_cost, 0, 'redeem:' || _reward.id);

  INSERT INTO public.reward_redemptions(user_id, reward_id, code, points_spent, status)
  VALUES (_user_id, _reward.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), _reward.points_cost, 'active')
  RETURNING * INTO _redemption;

  IF _reward.category = 'cash' AND COALESCE(_reward.cash_value_eur, 0) > 0 THEN
    INSERT INTO public.payout_requests(user_id, points_redeemed, amount_eur, status, iban_snapshot)
    VALUES (_user_id, _reward.points_cost, _reward.cash_value_eur, 'pending', _profile.iban);
  END IF;

  RETURN _redemption;
END;
$function$;