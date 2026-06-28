REVOKE EXECUTE ON FUNCTION public.generate_company_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_code(text) TO service_role;