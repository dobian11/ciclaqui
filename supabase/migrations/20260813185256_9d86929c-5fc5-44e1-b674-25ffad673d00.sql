DROP POLICY IF EXISTS "members read their own company" ON public.companies;
CREATE POLICY "owners and admins read their company" ON public.companies
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "managers read employees" ON public.profiles;