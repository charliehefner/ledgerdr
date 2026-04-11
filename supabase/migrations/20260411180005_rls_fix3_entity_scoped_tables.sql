-- RLS Fix 3: Apply entity-scoped RLS using user_has_entity_access(entity_id) to all tables
-- whose policies were dropped in migration 20260405125715 without replacement.
--
-- Pattern used throughout this file:
--   SELECT  → user_has_entity_access(entity_id)  (any user with any role on the entity)
--   DML     → has_role_for_entity per role        (scoped to the entity via entity_id,
--                                                   entity_group_id, or global null-scoped role)
--
-- Tables in order of user priority:
--   1. transactions
--   2. journals
--   3. journal_lines
--   4. employees
--   5. payroll_periods
--   6. Remaining payroll: employee_timesheets, period_employee_benefits
--   7. Employee sub-tables: employee_benefits, employee_documents, employee_incidents,
--      employee_loans, employee_salary_history, employee_vacations
--   8. Operations: operations, operation_inputs, farms, fields (join-based)
--   9. Fuel: fuel_equipment, fuel_tanks, fuel_transactions
--  10. Inventory: inventory_items, inventory_purchases
--  11. Day labor: day_labor_entries, jornaleros, cronograma_entries, cronograma_weeks
--  12. Service contracts: service_contracts, service_contract_entries,
--      service_contract_line_items (join-based), service_contract_payments
--  13. Other: implements, tractor_maintenance, transaction_attachments (open authenticated)

-- ============================================================
-- 1. transactions
-- ============================================================
CREATE POLICY "entity_select_transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 2. journals
-- ============================================================
CREATE POLICY "entity_select_journals" ON public.journals FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_journals" ON public.journals FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_journals" ON public.journals FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

-- Accountants can insert and update journals but not delete posted entries.
CREATE POLICY "entity_accountant_journals" ON public.journals FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 3. journal_lines
-- ============================================================
CREATE POLICY "entity_select_journal_lines" ON public.journal_lines FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_journal_lines" ON public.journal_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_journal_lines" ON public.journal_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_journal_lines" ON public.journal_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 4. employees
-- ============================================================
CREATE POLICY "entity_select_employees" ON public.employees FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employees" ON public.employees FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employees" ON public.employees FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employees" ON public.employees FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 5. payroll_periods
-- ============================================================
CREATE POLICY "entity_select_payroll_periods" ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_payroll_periods" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_payroll_periods" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_payroll_periods" ON public.payroll_periods FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 6. employee_timesheets
-- ============================================================
CREATE POLICY "entity_select_employee_timesheets" ON public.employee_timesheets FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_timesheets" ON public.employee_timesheets FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_timesheets" ON public.employee_timesheets FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_timesheets" ON public.employee_timesheets FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_employee_timesheets" ON public.employee_timesheets FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 7. period_employee_benefits
-- ============================================================
CREATE POLICY "entity_select_period_employee_benefits" ON public.period_employee_benefits FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_period_employee_benefits" ON public.period_employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_period_employee_benefits" ON public.period_employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_period_employee_benefits" ON public.period_employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 8. employee_benefits
-- ============================================================
CREATE POLICY "entity_select_employee_benefits" ON public.employee_benefits FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_benefits" ON public.employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_benefits" ON public.employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_benefits" ON public.employee_benefits FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 9. employee_documents
-- ============================================================
CREATE POLICY "entity_select_employee_documents" ON public.employee_documents FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_documents" ON public.employee_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_documents" ON public.employee_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_documents" ON public.employee_documents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 10. employee_incidents
-- ============================================================
CREATE POLICY "entity_select_employee_incidents" ON public.employee_incidents FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_incidents" ON public.employee_incidents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_incidents" ON public.employee_incidents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_incidents" ON public.employee_incidents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- Supervisors can create and view incidents for their entity
CREATE POLICY "entity_supervisor_employee_incidents" ON public.employee_incidents FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 11. employee_loans
-- ============================================================
CREATE POLICY "entity_select_employee_loans" ON public.employee_loans FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_loans" ON public.employee_loans FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_loans" ON public.employee_loans FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_loans" ON public.employee_loans FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 12. employee_salary_history
-- ============================================================
CREATE POLICY "entity_select_employee_salary_history" ON public.employee_salary_history FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_salary_history" ON public.employee_salary_history FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_salary_history" ON public.employee_salary_history FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_salary_history" ON public.employee_salary_history FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 13. employee_vacations
-- ============================================================
CREATE POLICY "entity_select_employee_vacations" ON public.employee_vacations FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_employee_vacations" ON public.employee_vacations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_employee_vacations" ON public.employee_vacations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_employee_vacations" ON public.employee_vacations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 14. operations
-- ============================================================
CREATE POLICY "entity_select_operations" ON public.operations FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_operations" ON public.operations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_operations" ON public.operations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_operations" ON public.operations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_operations" ON public.operations FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 15. operation_inputs
-- ============================================================
CREATE POLICY "entity_select_operation_inputs" ON public.operation_inputs FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_operation_inputs" ON public.operation_inputs FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_operation_inputs" ON public.operation_inputs FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_operation_inputs" ON public.operation_inputs FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_operation_inputs" ON public.operation_inputs FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 16. farms
-- ============================================================
CREATE POLICY "entity_select_farms" ON public.farms FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_farms" ON public.farms FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_farms" ON public.farms FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

-- ============================================================
-- 17. fields
-- fields has no entity_id column; scoped via farms.entity_id through farm_id FK.
-- ============================================================
CREATE POLICY "entity_select_fields" ON public.fields FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id
        AND public.user_has_entity_access(f.entity_id)
    )
  );

CREATE POLICY "entity_admin_fields" ON public.fields FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, f.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, f.entity_id)
    )
  );

CREATE POLICY "entity_mgmt_fields" ON public.fields FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, f.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farm_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, f.entity_id)
    )
  );

-- ============================================================
-- 18. fuel_equipment
-- ============================================================
CREATE POLICY "entity_select_fuel_equipment" ON public.fuel_equipment FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_fuel_equipment" ON public.fuel_equipment FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_fuel_equipment" ON public.fuel_equipment FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_supervisor_fuel_equipment" ON public.fuel_equipment FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 19. fuel_tanks
-- ============================================================
CREATE POLICY "entity_select_fuel_tanks" ON public.fuel_tanks FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_fuel_tanks" ON public.fuel_tanks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_fuel_tanks" ON public.fuel_tanks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

-- ============================================================
-- 20. fuel_transactions
-- ============================================================
CREATE POLICY "entity_select_fuel_transactions" ON public.fuel_transactions FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_fuel_transactions" ON public.fuel_transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_fuel_transactions" ON public.fuel_transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_supervisor_fuel_transactions" ON public.fuel_transactions FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 21. inventory_items
-- ============================================================
CREATE POLICY "entity_select_inventory_items" ON public.inventory_items FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_inventory_items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_inventory_items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_inventory_items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_inventory_items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 22. inventory_purchases
-- ============================================================
CREATE POLICY "entity_select_inventory_purchases" ON public.inventory_purchases FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_inventory_purchases" ON public.inventory_purchases FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_inventory_purchases" ON public.inventory_purchases FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_inventory_purchases" ON public.inventory_purchases FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_inventory_purchases" ON public.inventory_purchases FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 23. day_labor_entries
-- ============================================================
CREATE POLICY "entity_select_day_labor_entries" ON public.day_labor_entries FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_day_labor_entries" ON public.day_labor_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_day_labor_entries" ON public.day_labor_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_day_labor_entries" ON public.day_labor_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_day_labor_entries" ON public.day_labor_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 24. jornaleros
-- ============================================================
CREATE POLICY "entity_select_jornaleros" ON public.jornaleros FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_jornaleros" ON public.jornaleros FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_jornaleros" ON public.jornaleros FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_supervisor_jornaleros" ON public.jornaleros FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 25. cronograma_entries
-- ============================================================
CREATE POLICY "entity_select_cronograma_entries" ON public.cronograma_entries FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_cronograma_entries" ON public.cronograma_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_cronograma_entries" ON public.cronograma_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_cronograma_entries" ON public.cronograma_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_cronograma_entries" ON public.cronograma_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 26. cronograma_weeks
-- ============================================================
CREATE POLICY "entity_select_cronograma_weeks" ON public.cronograma_weeks FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_cronograma_weeks" ON public.cronograma_weeks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_cronograma_weeks" ON public.cronograma_weeks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_cronograma_weeks" ON public.cronograma_weeks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_cronograma_weeks" ON public.cronograma_weeks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 27. service_contracts
-- ============================================================
CREATE POLICY "entity_select_service_contracts" ON public.service_contracts FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_service_contracts" ON public.service_contracts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_service_contracts" ON public.service_contracts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_service_contracts" ON public.service_contracts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_service_contracts" ON public.service_contracts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 28. service_contract_entries
-- ============================================================
CREATE POLICY "entity_select_service_contract_entries" ON public.service_contract_entries FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_service_contract_entries" ON public.service_contract_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_service_contract_entries" ON public.service_contract_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_service_contract_entries" ON public.service_contract_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_service_contract_entries" ON public.service_contract_entries FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 29. service_contract_line_items
-- No entity_id; scoped via service_contract_entries.entity_id through entry_id FK.
-- ============================================================
CREATE POLICY "entity_select_service_contract_line_items" ON public.service_contract_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.user_has_entity_access(sce.entity_id)
    )
  );

CREATE POLICY "entity_admin_service_contract_line_items" ON public.service_contract_line_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, sce.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'admin'::app_role, sce.entity_id)
    )
  );

CREATE POLICY "entity_mgmt_service_contract_line_items" ON public.service_contract_line_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, sce.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'management'::app_role, sce.entity_id)
    )
  );

CREATE POLICY "entity_accountant_service_contract_line_items" ON public.service_contract_line_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, sce.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'accountant'::app_role, sce.entity_id)
    )
  );

CREATE POLICY "entity_supervisor_service_contract_line_items" ON public.service_contract_line_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, sce.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_contract_entries sce
      WHERE sce.id = entry_id
        AND public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, sce.entity_id)
    )
  );

-- ============================================================
-- 30. service_contract_payments
-- ============================================================
CREATE POLICY "entity_select_service_contract_payments" ON public.service_contract_payments FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_service_contract_payments" ON public.service_contract_payments FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_service_contract_payments" ON public.service_contract_payments FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_service_contract_payments" ON public.service_contract_payments FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- 31. implements
-- ============================================================
CREATE POLICY "entity_select_implements" ON public.implements FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_implements" ON public.implements FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_implements" ON public.implements FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_implements" ON public.implements FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_supervisor_implements" ON public.implements FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 32. tractor_maintenance
-- ============================================================
CREATE POLICY "entity_select_tractor_maintenance" ON public.tractor_maintenance FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_tractor_maintenance" ON public.tractor_maintenance FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_tractor_maintenance" ON public.tractor_maintenance FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_supervisor_tractor_maintenance" ON public.tractor_maintenance FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));

-- ============================================================
-- 33. transaction_attachments
-- No entity_id column; transaction_id is TEXT and is not a FK to transactions.id (UUID).
-- Restore to authenticated-only access matching the previous pre-entity policy,
-- which granted any authenticated user view/insert/update and admins delete.
-- ============================================================
CREATE POLICY "attachments_select" ON public.transaction_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "attachments_insert" ON public.transaction_attachments FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "attachments_update" ON public.transaction_attachments FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "attachments_admin_delete" ON public.transaction_attachments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
