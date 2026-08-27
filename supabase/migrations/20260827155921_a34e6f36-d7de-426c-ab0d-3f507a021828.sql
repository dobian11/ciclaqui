CREATE OR REPLACE FUNCTION public.create_trip_flag(
  _trip_id uuid,
  _user_id uuid,
  _company_id uuid,
  _score numeric,
  _declared_mode text,
  _predicted_mode text,
  _reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.trip_flags(trip_id, user_id, company_id, score, declared_mode, predicted_mode, reason, status, created_by)
  VALUES (_trip_id, _user_id, _company_id, _score, _declared_mode, _predicted_mode, _reason, 'pending', NULL)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_trip_flag(uuid, uuid, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip_flag(uuid, uuid, uuid, numeric, text, text, text) TO service_role;