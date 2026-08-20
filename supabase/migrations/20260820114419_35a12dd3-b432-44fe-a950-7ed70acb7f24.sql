REVOKE ALL ON FUNCTION public.award_challenge_podium(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_challenge_podium(uuid) TO service_role;