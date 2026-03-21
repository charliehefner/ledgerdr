// Storage configuration SQL
export const STORAGE_SQL = `-- =============================================
-- STORAGE BUCKET CONFIGURATION
-- Ledger DR - File Storage Setup
-- =============================================

-- Create private storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('transaction-attachments', 'transaction-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('employee-documents', 'employee-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for transaction-attachments
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

CREATE POLICY "Authenticated users can view transaction attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can delete transaction attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND public.has_role(auth.uid(), 'admin')
);

-- Storage RLS policies for employee-documents
CREATE POLICY "Authorized users can upload employee documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
  )
);

CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can delete employee documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND public.has_role(auth.uid(), 'admin')
);
`;
