-- Allow admin, management, and office roles to update (overwrite) employee documents.
-- Previously, ALL updates were blocked which forced a cumbersome "upload new + delete old" workaround.
DROP POLICY IF EXISTS "No updates on employee documents" ON storage.objects;

CREATE POLICY "Authorized users can update employee documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'office')
  )
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'office')
  )
);