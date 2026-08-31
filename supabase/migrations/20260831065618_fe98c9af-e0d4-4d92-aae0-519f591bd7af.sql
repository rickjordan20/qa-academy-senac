DROP POLICY IF EXISTS "evidencias_instructor_read" ON storage.objects;

CREATE POLICY "evidencias_instructor_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND public.qa_is_instructor_of(((storage.foldername(name))[1])::uuid, auth.uid())
);