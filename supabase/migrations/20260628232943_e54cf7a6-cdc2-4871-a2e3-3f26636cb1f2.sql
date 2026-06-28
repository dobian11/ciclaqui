
-- ============ companies: restrict sensitive columns ============
DROP POLICY IF EXISTS "anyone can read companies (for code validation)" ON public.companies;

REVOKE SELECT ON public.companies FROM anon, authenticated;
GRANT SELECT (id, code, name, kind, status) ON public.companies TO anon, authenticated;

CREATE POLICY "public can read safe company columns"
ON public.companies FOR SELECT
TO anon, authenticated
USING (true);

-- ============ point_transactions: admin-only writes ============
CREATE POLICY "admins insert point tx"
ON public.point_transactions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete point tx"
ON public.point_transactions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ trips: owner-scoped writes ============
CREATE POLICY "users insert own trips"
ON public.trips FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own trips"
ON public.trips FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users delete own trips"
ON public.trips FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============ user_roles: admin-only writes ============
CREATE POLICY "admins insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ wallets: owner insert, admin delete ============
CREATE POLICY "users insert own wallet"
ON public.wallets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins delete wallets"
ON public.wallets FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ trip_flags: admin-only insert ============
CREATE POLICY "admins insert trip flags"
ON public.trip_flags FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ storage: enforce manager role on company-docs update/delete ============
DROP POLICY IF EXISTS "Managers delete own company docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers update own company docs" ON storage.objects;

CREATE POLICY "Managers delete own company docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-docs'
  AND public.has_role(auth.uid(), 'company_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.company_id)::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Managers update own company docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-docs'
  AND public.has_role(auth.uid(), 'company_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.company_id)::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'company-docs'
  AND public.has_role(auth.uid(), 'company_manager'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.company_id)::text = (storage.foldername(name))[1]
  )
);
