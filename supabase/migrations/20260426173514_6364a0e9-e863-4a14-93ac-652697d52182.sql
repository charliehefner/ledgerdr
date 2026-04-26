-- Operational tables with entity_id: full write scoped to entity
CREATE POLICY "entity_office_transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_inventory_items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_inventory_purchases" ON public.inventory_purchases
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_fuel_transactions" ON public.fuel_transactions
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_fuel_tanks" ON public.fuel_tanks
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_fuel_equipment" ON public.fuel_equipment
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_tractor_maintenance" ON public.tractor_maintenance
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_operations" ON public.operations
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_operation_inputs" ON public.operation_inputs
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_cronograma_entries" ON public.cronograma_entries
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_industrial_plant_hours" ON public.industrial_plant_hours
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_industrial_trucks" ON public.industrial_trucks
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_industrial_carretas" ON public.industrial_carretas
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_jornaleros" ON public.jornaleros
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_day_labor_entries" ON public.day_labor_entries
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_service_contracts" ON public.service_contracts
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employee_loans" ON public.employee_loans
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_employee_documents" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

-- service_providers (no entity_id)
CREATE POLICY "office_service_providers_all" ON public.service_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'office'::app_role));

-- rainfall_records (no entity_id; global table)
CREATE POLICY "office_rainfall_insert" ON public.rainfall_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_rainfall_update" ON public.rainfall_records
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'office'::app_role));

-- ============================================================
-- READ-ONLY access on financial / treasury / approval tables
-- ============================================================

CREATE POLICY "office_read_journals" ON public.journals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_journal_lines" ON public.journal_lines
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_chart_of_accounts" ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_ap_ar_documents" ON public.ap_ar_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_bank_accounts" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_bank_statement_lines" ON public.bank_statement_lines
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_fixed_assets" ON public.fixed_assets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_approval_requests" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));

CREATE POLICY "office_read_approval_policies" ON public.approval_policies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'office'::app_role));
