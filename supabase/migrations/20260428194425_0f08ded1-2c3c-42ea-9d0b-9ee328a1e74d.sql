-- 1. Grant Office role full access to transaction_attachments rows scoped to their entity
DROP POLICY IF EXISTS "Office full access" ON public.transaction_attachments;
CREATE POLICY "Office full access" ON public.transaction_attachments
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.id = transaction_attachments.transaction_id
    AND public.has_role_for_entity(auth.uid(), 'office'::app_role, t.entity_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.id = transaction_attachments.transaction_id
    AND public.has_role_for_entity(auth.uid(), 'office'::app_role, t.entity_id)
));

-- 2. Storage: allow Office to upload to and view from transaction-attachments bucket
DROP POLICY IF EXISTS "Authorized users can upload transaction attachments" ON storage.objects;
CREATE POLICY "Authorized users can upload transaction attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transaction-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
);

DROP POLICY IF EXISTS "Authorized roles can view transaction attachments" ON storage.objects;
CREATE POLICY "Authorized roles can view transaction attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
);