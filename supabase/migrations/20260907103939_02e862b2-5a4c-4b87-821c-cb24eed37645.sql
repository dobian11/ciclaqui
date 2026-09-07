REVOKE EXECUTE ON FUNCTION public.get_my_prize_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_prize_code(uuid) TO service_role;