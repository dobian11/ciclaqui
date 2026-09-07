-- Tetto mensile di guadagno per utente (default 50 €)
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS monthly_cap_eur numeric(10,2) NOT NULL DEFAULT 50;

UPDATE public.app_config SET monthly_cap_eur = 50, updated_at = now() WHERE id = 1;

-- Accredito punti con tetto mensile: oltre monthly_cap_eur (in € di viaggi del mese)
-- i punti dei viaggi non vengono più accreditati fino al mese successivo.
CREATE OR REPLACE FUNCTION public.credit_trip_points(
  _user_id uuid,
  _trip_id uuid,
  _points integer,
  _eur_per_point numeric,
  _distance_km numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pts integer := GREATEST(COALESCE(_points, 0), 0);
  _eur_per_pt numeric := COALESCE(_eur_per_point, 0);
  _km numeric := ROUND(GREATEST(COALESCE(_distance_km, 0), 0), 2);
  _cap_eur numeric;
  _month_eur numeric;
  _remaining_eur numeric;
  _eur numeric;
BEGIN
  -- Tetto mensile in € (dalla configurazione)
  SELECT monthly_cap_eur INTO _cap_eur FROM public.app_config WHERE id = 1;
  _cap_eur := COALESCE(_cap_eur, 50);

  IF _pts > 0 AND _eur_per_pt > 0 THEN
    -- Quanto ha già guadagnato questo mese con i viaggi
    SELECT COALESCE(SUM(delta_eur), 0) INTO _month_eur
    FROM public.point_transactions
    WHERE user_id = _user_id
      AND reason = 'trip'
      AND delta_eur > 0
      AND created_at >= date_trunc('month', now());

    _remaining_eur := GREATEST(_cap_eur - _month_eur, 0);
    _pts := LEAST(_pts, floor(_remaining_eur / _eur_per_pt)::int);
  END IF;

  _eur := ROUND(_pts * _eur_per_pt, 2);

  IF _pts > 0 THEN
    INSERT INTO public.point_transactions (user_id, trip_id, delta_points, delta_eur, reason)
    VALUES (_user_id, _trip_id, _pts, _eur, 'trip');
  END IF;

  INSERT INTO public.wallets (user_id, points_balance, eur_balance, lifetime_points, lifetime_km)
  VALUES (_user_id, _pts, _eur, _pts, _km)
  ON CONFLICT (user_id) DO UPDATE SET
    points_balance = public.wallets.points_balance + _pts,
    eur_balance = ROUND(public.wallets.eur_balance + _eur, 2),
    lifetime_points = public.wallets.lifetime_points + _pts,
    lifetime_km = ROUND(public.wallets.lifetime_km + _km, 2),
    updated_at = now();
END;
$$;

-- Solo il sistema (service role) può accreditare punti
REVOKE ALL ON FUNCTION public.credit_trip_points(uuid, uuid, integer, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_trip_points(uuid, uuid, integer, numeric, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_trip_points(uuid, uuid, integer, numeric, numeric) TO service_role;