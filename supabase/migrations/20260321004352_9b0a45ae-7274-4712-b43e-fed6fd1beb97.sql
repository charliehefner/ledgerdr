-- Drop all existing storage policies on objects for both buckets
DROP POLICY IF EXISTS "Authenticated users can upload attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Accountants can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

-- transaction-attachments: INSERT (accountant, admin, management)
CREATE POLICY "Authorized users can upload transaction attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transaction-attachments'
  AND (
    public.has_role(auth.uid(), 'accountant')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
  )
);

-- transaction-attachments: SELECT (all authenticated)
CREATE POLICY "Authenticated users can view transaction attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND auth.role() = 'authenticated'
);

-- transaction-attachments: DELETE (admin only)
CREATE POLICY "Admins can delete transaction attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND public.has_role(auth.uid(), 'admin')
);

-- employee-documents: INSERT (admin, management)
CREATE POLICY "Authorized users can upload employee documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
  )
);

-- employee-documents: SELECT (all authenticated)
CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND auth.role() = 'authenticated'
);

-- employee-documents: DELETE (admin only)
CREATE POLICY "Admins can delete employee documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
);