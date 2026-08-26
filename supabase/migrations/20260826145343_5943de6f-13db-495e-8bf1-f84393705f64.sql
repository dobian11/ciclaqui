-- payout_requests: no direct client creation; must go through request_payout_for_user RPC (service role / definer)
DROP POLICY IF EXISTS "users create own payouts" ON public.payout_requests;
REVOKE INSERT, UPDATE, DELETE ON public.payout_requests FROM authenticated;

-- trips: no direct client insert/update; all writes via server functions (service role)
DROP POLICY IF EXISTS "users insert own trips" ON public.trips;
DROP POLICY IF EXISTS "users update own trips" ON public.trips;
CREATE POLICY "admins update trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE INSERT ON public.trips FROM authenticated;