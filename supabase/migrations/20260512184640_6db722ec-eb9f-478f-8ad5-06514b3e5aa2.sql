INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-documents', 'vehicle-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Helper expression: first folder = entity_id (uuid)
-- Read: any role on the entity
CREATE POLICY "vehicle_docs_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (
    has_role_for_entity(auth.uid(), 'admin'::app_role,      ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'management'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'accountant'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'supervisor'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'office'::app_role,     ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'viewer'::app_role,     ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'driver'::app_role,     ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "vehicle_docs_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents'
  AND (
    has_role_for_entity(auth.uid(), 'admin'::app_role,      ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'management'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'accountant'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'supervisor'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'office'::app_role,     ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "vehicle_docs_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (
    has_role_for_entity(auth.uid(), 'admin'::app_role,      ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'management'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'accountant'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'supervisor'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'office'::app_role,     ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "vehicle_docs_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND (
    has_role_for_entity(auth.uid(), 'admin'::app_role,      ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'management'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'accountant'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'supervisor'::app_role, ((storage.foldername(name))[1])::uuid)
    OR has_role_for_entity(auth.uid(), 'office'::app_role,     ((storage.foldername(name))[1])::uuid)
  )
);