CREATE POLICY "entity_admin_payroll_snapshots" ON public.payroll_snapshots FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_accountant_payroll_snapshots" ON public.payroll_snapshots FOR SELECT TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));