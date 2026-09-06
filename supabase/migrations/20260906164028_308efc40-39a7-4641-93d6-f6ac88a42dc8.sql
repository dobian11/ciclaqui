-- 1) Companies: only non-sensitive columns updatable by non-admin owners
REVOKE UPDATE ON public.companies FROM authenticated;
GRANT UPDATE (name, vat, iban, contact_email, tracking_start, tracking_end, tracking_days)
  ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- 2) challenge_prizes: hide awarded_code from regular authenticated reads
REVOKE SELECT ON public.challenge_prizes FROM authenticated;
GRANT SELECT (id, challenge_id, rank_position, points, reward_id, label,
              awarded_user_id, awarded_at, created_at, updated_at)
  ON public.challenge_prizes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.challenge_prizes TO authenticated;
GRANT ALL ON public.challenge_prizes TO service_role;