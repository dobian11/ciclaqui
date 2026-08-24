ALTER TABLE public.bikes ADD COLUMN IF NOT EXISTS stolen_evidence text[];

-- Accesso al bucket privato bike-evidence: solo il proprietario della cartella (<user_id>/...)
CREATE POLICY "bike_evidence_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bike-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "bike_evidence_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bike-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "bike_evidence_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bike-evidence' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'bike-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "bike_evidence_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bike-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);