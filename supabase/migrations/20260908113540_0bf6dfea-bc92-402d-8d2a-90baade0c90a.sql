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
  _min_points integer;
  _is_cash boolean;
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

  _is_cash := (_reward.category = 'cash' AND COALESCE(_reward.cash_value_eur, 0) > 0);

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Punti insufficienti'; END IF;

  IF _is_cash THEN
    SELECT GREATEST(500, ceil(payout_threshold_eur / NULLIF(eur_per_point, 0))::int)
      INTO _min_points FROM public.app_config WHERE id = 1;
    _min_points := COALESCE(_min_points, 500);
    IF _wallet.points_balance < _min_points THEN
      RAISE EXCEPTION 'Servono almeno % punti per riscattare un premio in denaro', _min_points;
    END IF;
  END IF;

  IF _wallet.points_balance < _reward.points_cost THEN RAISE EXCEPTION 'Punti insufficienti'; END IF;

  IF _is_cash THEN
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

  INSERT INTO public.reward_redemptions(user_id, reward_id, code, points_spent, status, expires_at)
  VALUES (_user_id, _reward.id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
          _reward.points_cost, 'active', now() + interval '12 months')
  RETURNING * INTO _redemption;

  IF _is_cash THEN
    INSERT INTO public.payout_requests(user_id, points_redeemed, amount_eur, status, iban_snapshot)
    VALUES (_user_id, _reward.points_cost, _reward.cash_value_eur, 'pending', _profile.iban);
  END IF;

  RETURN _redemption;
END;
$function$;