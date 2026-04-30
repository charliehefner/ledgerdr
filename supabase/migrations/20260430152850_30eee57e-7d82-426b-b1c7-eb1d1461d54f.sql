DROP POLICY IF EXISTS "Authorized roles can view employee documents" ON storage.objects;
CREATE POLICY "Authorized roles can view employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'office'::app_role)
  )
);

DROP POLICY IF EXISTS "Authorized users can upload employee documents" ON storage.objects;
CREATE POLICY "Authorized users can upload employee documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'management'::app_role)
    OR has_role(auth.uid(), 'office'::app_role)
  )
);