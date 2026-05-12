CREATE POLICY "Office full access" ON public.vehicles
  FOR ALL TO authenticated
  USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "Office full access" ON public.vehicle_maintenance
  FOR ALL TO authenticated
  USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));