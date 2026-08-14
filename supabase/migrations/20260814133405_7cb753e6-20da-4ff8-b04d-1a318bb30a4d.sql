DROP POLICY IF EXISTS "public lookup stolen bikes" ON public.bikes;
DROP POLICY IF EXISTS "anon can report sighting on stolen bike" ON public.bike_reports;
REVOKE ALL ON public.bikes FROM anon;
REVOKE ALL ON public.bike_reports FROM anon;