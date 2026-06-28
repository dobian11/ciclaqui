
-- Path convention: company-docs / {company_id}/{review_id}/{filename}
CREATE POLICY "Managers upload own company docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-docs'
  AND public.has_role(auth.uid(), 'company_manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Managers view own company docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'company-docs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Managers update own company docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-docs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Managers delete own company docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-docs'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Admins manage all company docs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'company-docs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'company-docs' AND public.has_role(auth.uid(), 'admin'));
