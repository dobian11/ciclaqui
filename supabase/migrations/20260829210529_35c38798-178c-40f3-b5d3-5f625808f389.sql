REVOKE EXECUTE ON FUNCTION public.redeem_reward_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward_for_user(uuid, uuid) TO service_role;