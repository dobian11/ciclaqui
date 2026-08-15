-- 1. wallets: remove self-update policy (all wallet writes go through server functions with service role)
DROP POLICY IF EXISTS "users update own wallet stripe fields" ON public.wallets;
REVOKE UPDATE ON public.wallets FROM authenticated;

-- 2. bike_reports: allow moderation by admins and by the bike owner
CREATE POLICY "admins update reports" ON public.bike_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins and bike owners delete reports" ON public.bike_reports
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR bike_id IN (SELECT b.id FROM public.bikes b WHERE b.owner_id = auth.uid())
  );