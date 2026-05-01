CREATE POLICY "entity_office_payroll_snapshots"
ON public.payroll_snapshots FOR SELECT
USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));