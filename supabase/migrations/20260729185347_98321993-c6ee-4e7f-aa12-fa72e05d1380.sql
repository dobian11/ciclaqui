CREATE OR REPLACE FUNCTION public.owns_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = _company_id AND c.created_by = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_company(uuid) TO authenticated, service_role;

-- company_reviews: manager select scoped to company owner
DROP POLICY IF EXISTS "Managers can view own company reviews" ON public.company_reviews;
CREATE POLICY "Managers can view own company reviews"
ON public.company_reviews FOR SELECT TO authenticated
USING (public.owns_company(company_id) AND has_role(auth.uid(), 'company_manager'::app_role));

DROP POLICY IF EXISTS "Managers can submit own company reviews" ON public.company_reviews;
CREATE POLICY "Managers can submit own company reviews"
ON public.company_reviews FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND public.owns_company(company_id)
  AND has_role(auth.uid(), 'company_manager'::app_role)
);

-- rewards_catalog: manager manages only rewards of a company they own
DROP POLICY IF EXISTS "manager manages own local rewards" ON public.rewards_catalog;
CREATE POLICY "manager manages own local rewards"
ON public.rewards_catalog FOR ALL TO authenticated
USING (
  scope = 'local'::text AND company_id IS NOT NULL
  AND public.owns_company(company_id)
  AND has_role(auth.uid(), 'company_manager'::app_role)
)
WITH CHECK (
  scope = 'local'::text AND company_id IS NOT NULL
  AND public.owns_company(company_id)
  AND has_role(auth.uid(), 'company_manager'::app_role)
);

-- trip_flags: manager access scoped to company owner
DROP POLICY IF EXISTS "manager updates flags" ON public.trip_flags;
CREATE POLICY "manager updates flags"
ON public.trip_flags FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND public.owns_company(company_id) AND has_role(auth.uid(), 'company_manager'::app_role))
);

DROP POLICY IF EXISTS "user reads own flags" ON public.trip_flags;
CREATE POLICY "user reads own flags"
ON public.trip_flags FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND public.owns_company(company_id) AND has_role(auth.uid(), 'company_manager'::app_role))
);