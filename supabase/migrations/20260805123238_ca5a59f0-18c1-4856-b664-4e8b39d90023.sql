CREATE OR REPLACE FUNCTION public.request_payout_for_user(_user_id uuid, _points integer, _iban text)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet public.wallets%ROWTYPE;
  _amount numeric;
  _payout public.payout_requests%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta'; END IF;
  IF _points IS NULL OR _points < 50 THEN RAISE EXCEPTION 'Minimo 50 punti per prelevare'; END IF;
  IF _iban IS NULL OR length(_iban) < 15 THEN RAISE EXCEPTION 'IBAN non valido'; END IF;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet non trovato'; END IF;
  IF _wallet.points_balance < _points THEN
    RAISE EXCEPTION 'Saldo insufficiente: hai % punti', _wallet.points_balance;
  END IF;

  _amount := round(_points * 0.01, 2);

  UPDATE public.profiles SET iban = _iban WHERE id = _user_id;

  UPDATE public.wallets
     SET points_balance = points_balance - _points,
         eur_balance = GREATEST(0, eur_balance - _amount)
   WHERE user_id = _user_id;

  INSERT INTO public.point_transactions(user_id, delta_points, delta_eur, reason)
  VALUES (_user_id, -_points, -_amount, 'payout_request');

  INSERT INTO public.payout_requests(user_id, points_redeemed, amount_eur, status, iban_snapshot)
  VALUES (_user_id, _points, _amount, 'pending', _iban)
  RETURNING * INTO _payout;

  RETURN _payout;
END;
$$;

REVOKE ALL ON FUNCTION public.request_payout_for_user(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payout_for_user(uuid, integer, text) TO service_role;