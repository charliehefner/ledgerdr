DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

CREATE POLICY "Authorized users can delete employee documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'office')
  )
);