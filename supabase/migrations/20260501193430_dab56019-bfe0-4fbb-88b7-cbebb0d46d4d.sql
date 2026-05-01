CREATE POLICY "entity_office_employee_timesheets"
ON public.employee_timesheets FOR ALL
TO authenticated
USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_payroll_periods"
ON public.payroll_periods FOR ALL
TO authenticated
USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));