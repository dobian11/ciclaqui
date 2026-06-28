
REVOKE ALL ON FUNCTION public.bump_streak(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_streak(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_leaderboard(uuid) TO service_role;
