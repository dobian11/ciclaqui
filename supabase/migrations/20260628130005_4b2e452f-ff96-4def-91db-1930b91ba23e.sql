
-- Grant Data API access on all public tables (missing from prior migrations)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bikes TO authenticated;
GRANT SELECT ON public.bikes TO anon; -- public stolen bike lookup
GRANT ALL ON public.bikes TO service_role;

GRANT SELECT, INSERT ON public.bike_reports TO authenticated;
GRANT INSERT ON public.bike_reports TO anon; -- anyone can report sighting via policy
GRANT ALL ON public.bike_reports TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

GRANT SELECT ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;

GRANT SELECT ON public.app_config TO authenticated;
GRANT SELECT ON public.app_config TO anon;
GRANT ALL ON public.app_config TO service_role;

-- Public sighting report policy: anyone (even anon) can submit a sighting on a stolen bike
DROP POLICY IF EXISTS "anon can report sighting on stolen bike" ON public.bike_reports;
CREATE POLICY "anon can report sighting on stolen bike"
ON public.bike_reports FOR INSERT TO anon
WITH CHECK (
  type = 'sighting' AND
  bike_id IN (SELECT id FROM public.bikes WHERE status = 'rubata')
);
