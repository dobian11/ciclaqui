DROP POLICY IF EXISTS "everyone reads active rewards" ON public.rewards_catalog;

CREATE POLICY "public reads active non-company rewards"
ON public.rewards_catalog
FOR SELECT
TO anon, authenticated
USING (active = true AND scope <> 'company');

CREATE POLICY "members read own company rewards"
ON public.rewards_catalog
FOR SELECT
TO authenticated
USING (
  scope = 'company'
  AND company_id IS NOT NULL
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.company_id = rewards_catalog.company_id
    )
  )
);