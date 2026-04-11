-- RLS Fix 4: Restore policies for ap_ar_documents, ap_ar_payments, and pending_fuel_submissions.
-- All three had policies dropped by prior migrations without replacement:
--   ap_ar_documents  — 4 policies dropped in 20260405123942, never restored
--   ap_ar_payments   — 2 policies dropped in 20260405123942, never restored
--   pending_fuel_submissions — entity_driver_insert_pending dropped in 20260405131442, never restored

-- ============================================================
-- ap_ar_documents
-- Has entity_id (DEFAULT added in 20260403002721).
-- Original access: any authenticated user could read; admin/accountant could write.
-- Elevated to entity-scoped to match the rest of the schema.
-- ============================================================

CREATE POLICY "entity_select_ap_ar_documents" ON public.ap_ar_documents FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_ap_ar_documents" ON public.ap_ar_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_ap_ar_documents" ON public.ap_ar_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_ap_ar_documents" ON public.ap_ar_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- ap_ar_payments
-- No entity_id column — scoped via ap_ar_documents.entity_id through document_id FK.
-- Original access: any authenticated user could view; admin/management/accountant could insert.
-- ============================================================

CREATE POLICY "entity_select_ap_ar_payments" ON public.ap_ar_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.user_has_entity_access(d.entity_id)
    )
  );

CREATE POLICY "entity_admin_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
    )
  );

CREATE POLICY "entity_mgmt_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
    )
  );

CREATE POLICY "entity_accountant_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ap_ar_documents d
      WHERE d.id = document_id
        AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)
    )
  );

-- ============================================================
-- pending_fuel_submissions
-- No entity_id column.  Scoped by submitted_by (driver's own rows) and by role
-- (admin/management/supervisor can see all).  The fuel_transaction_id FK can be
-- NULL while the record is staging, so we cannot join to fuel_transactions for
-- entity scoping.
-- ============================================================

-- Drivers can insert their own pending submissions.
CREATE POLICY "fuel_submissions_driver_insert" ON public.pending_fuel_submissions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::app_role)
    AND submitted_by = auth.uid()
  );

-- Drivers can read their own pending submissions.
CREATE POLICY "fuel_submissions_driver_select" ON public.pending_fuel_submissions FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    AND public.has_role(auth.uid(), 'driver'::app_role)
  );

-- Admins, management, and supervisors can manage all pending submissions.
CREATE POLICY "fuel_submissions_admin_all" ON public.pending_fuel_submissions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );
