REVOKE ALL ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid, boolean) TO service_role;
DROP FUNCTION IF EXISTS public.apply_trip_to_challenges(uuid, text, numeric, uuid);