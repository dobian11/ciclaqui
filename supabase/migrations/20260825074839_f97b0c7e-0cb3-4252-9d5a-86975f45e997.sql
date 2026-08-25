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
  _eur numeric := ROUND(_pts * COALESCE(_eur_per_point, 0), 2);
  _km numeric := ROUND(GREATEST(COALESCE(_distance_km, 0), 0), 2);
BEGIN
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