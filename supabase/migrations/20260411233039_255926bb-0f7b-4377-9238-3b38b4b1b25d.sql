-- ap_ar_documents
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

-- ap_ar_payments (join-based via ap_ar_documents)
CREATE POLICY "entity_select_ap_ar_payments" ON public.ap_ar_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.user_has_entity_access(d.entity_id)));
CREATE POLICY "entity_admin_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)));
CREATE POLICY "entity_mgmt_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)));
CREATE POLICY "entity_accountant_ap_ar_payments" ON public.ap_ar_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ap_ar_documents d WHERE d.id = document_id AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)));

-- pending_fuel_submissions
CREATE POLICY "fuel_submissions_driver_insert" ON public.pending_fuel_submissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'driver'::app_role) AND submitted_by = auth.uid());
CREATE POLICY "fuel_submissions_driver_select" ON public.pending_fuel_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() AND public.has_role(auth.uid(), 'driver'::app_role));
CREATE POLICY "fuel_submissions_admin_all" ON public.pending_fuel_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'management'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'management'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));