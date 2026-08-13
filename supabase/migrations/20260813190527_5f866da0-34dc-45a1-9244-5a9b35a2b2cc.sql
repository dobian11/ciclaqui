-- 1. app_config: no public/anon reads
DROP POLICY IF EXISTS "anyone read config" ON public.app_config;
REVOKE SELECT ON public.app_config FROM anon;
CREATE POLICY "admins read config" ON public.app_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. bike_reports: anonymous sightings must never carry a reporter identity
DROP POLICY IF EXISTS "anon can report sighting on stolen bike" ON public.bike_reports;
CREATE POLICY "anon can report sighting on stolen bike" ON public.bike_reports
  FOR INSERT TO anon
  WITH CHECK (
    reporter_id IS NULL
    AND type = 'sighting'::bike_report_type
    AND bike_id IN (SELECT bikes.id FROM public.bikes WHERE bikes.status = 'rubata'::bike_status)
  );

DROP POLICY IF EXISTS "anyone can create report on stolen bike" ON public.bike_reports;
CREATE POLICY "users can create report on stolen bike" ON public.bike_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (reporter_id IS NULL OR reporter_id = auth.uid())
    AND bike_id IN (SELECT bikes.id FROM public.bikes WHERE bikes.status = 'rubata'::bike_status)
  );

-- Owners may read reports on their bikes, but not the reporter identity
DROP POLICY IF EXISTS "owners read reports on own bikes" ON public.bike_reports;
CREATE POLICY "reporters and admins read reports" ON public.bike_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.bike_reports_for_owner
WITH (security_invoker = off) AS
  SELECT r.id, r.bike_id, r.type, r.lat, r.lng, r.note, r.photo_url, r.created_at
  FROM public.bike_reports r
  JOIN public.bikes b ON b.id = r.bike_id
  WHERE b.owner_id = auth.uid();

GRANT SELECT ON public.bike_reports_for_owner TO authenticated;
GRANT ALL ON public.bike_reports_for_owner TO service_role;

-- 3. companies: financial/contact fields readable only by owner or admin (already enforced),
-- plus an explicitly safe public-facing projection for member-facing lookups
CREATE OR REPLACE VIEW public.companies_public
WITH (security_invoker = off) AS
  SELECT id, name, kind, status FROM public.companies;

GRANT SELECT ON public.companies_public TO authenticated;
GRANT ALL ON public.companies_public TO service_role;