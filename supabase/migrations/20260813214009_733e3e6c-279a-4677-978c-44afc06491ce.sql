ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS is_team boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trophy_label text;

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_by uuid;

CREATE INDEX IF NOT EXISTS idx_badges_company ON public.badges(company_id);

DROP POLICY IF EXISTS "Managers view own company docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers upload own company docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers update own company docs" ON storage.objects;
DROP POLICY IF EXISTS "Managers delete own company docs" ON storage.objects;

CREATE POLICY "Managers view own company docs" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'company-docs'
  AND public.owns_company(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Managers upload own company docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-docs'
  AND public.owns_company(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Managers update own company docs" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-docs'
  AND public.owns_company(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'company-docs'
  AND public.owns_company(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Managers delete own company docs" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'company-docs'
  AND public.owns_company(((storage.foldername(name))[1])::uuid)
);