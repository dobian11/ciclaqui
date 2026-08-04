-- Lock down SECURITY DEFINER execution. Internal/trigger functions are never client-callable.
REVOKE EXECUTE ON FUNCTION public.apply_trip_to_challenges(uuid, text, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_streak(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.company_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_company_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- Fix mutable search paths without changing function behavior.
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';

-- Enforce entity ownership for manager visibility.
DROP POLICY IF EXISTS "Managers view company badges" ON public.badges;
CREATE POLICY "Managers view owned-company badges"
ON public.badges FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'company_manager'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles employee
    WHERE employee.id = badges.user_id
      AND employee.company_id IS NOT NULL
      AND public.owns_company(employee.company_id)
  )
);

DROP POLICY IF EXISTS "Managers view company progress" ON public.user_challenges;
CREATE POLICY "Managers view owned-company progress"
ON public.user_challenges FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'company_manager'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles employee
    WHERE employee.id = user_challenges.user_id
      AND employee.company_id IS NOT NULL
      AND public.owns_company(employee.company_id)
  )
);

DROP POLICY IF EXISTS "Company members read own decision email logs" ON public.company_email_log;
CREATE POLICY "Company owners read decision email logs"
ON public.company_email_log FOR SELECT TO authenticated
USING (public.owns_company(company_id));