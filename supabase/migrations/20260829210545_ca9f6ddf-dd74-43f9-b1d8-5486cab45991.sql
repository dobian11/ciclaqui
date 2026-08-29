REVOKE EXECUTE ON FUNCTION public.get_my_prize_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_prize_code(uuid) TO authenticated;