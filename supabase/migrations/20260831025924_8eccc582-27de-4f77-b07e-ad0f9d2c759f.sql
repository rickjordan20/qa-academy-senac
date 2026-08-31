CREATE POLICY evidencias_own_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'evidencias' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'evidencias' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY evidencias_instructor_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND public.shares_class(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );