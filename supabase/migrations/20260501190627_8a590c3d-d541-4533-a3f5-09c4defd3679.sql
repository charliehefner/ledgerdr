-- Ensure Office can read all payroll data required to generate receipts for closed periods
DROP POLICY IF EXISTS "entity_office_payroll_snapshots" ON public.payroll_snapshots;
CREATE POLICY "entity_office_payroll_snapshots"
ON public.payroll_snapshots
FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

DROP POLICY IF EXISTS "entity_office_employee_benefits_select" ON public.employee_benefits;
CREATE POLICY "entity_office_employee_benefits_select"
ON public.employee_benefits
FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

-- Re-apply employee document table access for Office users with explicit per-action policies.
-- This avoids relying on a broad ALL policy when uploads/replacements are performed from the employee directory.
DROP POLICY IF EXISTS "entity_office_employee_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "entity_office_employee_documents_select" ON public.employee_documents;
DROP POLICY IF EXISTS "entity_office_employee_documents_insert" ON public.employee_documents;
DROP POLICY IF EXISTS "entity_office_employee_documents_update" ON public.employee_documents;
DROP POLICY IF EXISTS "entity_office_employee_documents_delete" ON public.employee_documents;

CREATE POLICY "entity_office_employee_documents_select"
ON public.employee_documents
FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employee_documents_insert"
ON public.employee_documents
FOR INSERT TO authenticated
WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employee_documents_update"
ON public.employee_documents
FOR UPDATE TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employee_documents_delete"
ON public.employee_documents
FOR DELETE TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

-- Normalize storage policies for Employee Directory documents.
DROP POLICY IF EXISTS "Authorized users can upload employee documents" ON storage.objects;
CREATE POLICY "Authorized users can upload employee documents"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
);

DROP POLICY IF EXISTS "Authorized users can update employee documents" ON storage.objects;
CREATE POLICY "Authorized users can update employee documents"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
);

DROP POLICY IF EXISTS "Authorized users can delete employee documents" ON storage.objects;
CREATE POLICY "Authorized users can delete employee documents"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'office'::app_role)
  )
);