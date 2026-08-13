REVOKE ALL ON FUNCTION public.confirm_company_topup(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pay_payout_from_company(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_company_topup(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_payout_from_company(uuid, uuid, uuid) TO service_role;