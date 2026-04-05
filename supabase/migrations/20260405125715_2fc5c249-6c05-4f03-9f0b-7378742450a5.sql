
-- ============================================================
-- BUG 3: Drop legacy has_role() policies on entity-scoped tables
-- ============================================================

-- cronograma_entries
DROP POLICY IF EXISTS "Admins, management, and supervisors can delete cronograma entri" ON public.cronograma_entries;
DROP POLICY IF EXISTS "Admins, management, and supervisors can update cronograma entri" ON public.cronograma_entries;
DROP POLICY IF EXISTS "Users with appropriate roles can view cronograma entries" ON public.cronograma_entries;

-- cronograma_weeks
DROP POLICY IF EXISTS "Admins, management, and supervisors can update cronograma weeks" ON public.cronograma_weeks;
DROP POLICY IF EXISTS "Users with appropriate roles can view cronograma weeks" ON public.cronograma_weeks;

-- day_labor_entries
DROP POLICY IF EXISTS "Accountants can delete open day labor entries" ON public.day_labor_entries;
DROP POLICY IF EXISTS "Accountants can update day labor entries" ON public.day_labor_entries;
DROP POLICY IF EXISTS "Accountants can view day labor entries" ON public.day_labor_entries;
DROP POLICY IF EXISTS "Admins have full access to day labor entries" ON public.day_labor_entries;
DROP POLICY IF EXISTS "Management has full access to day labor entries" ON public.day_labor_entries;
DROP POLICY IF EXISTS "Supervisor full access to day labor entries" ON public.day_labor_entries;

-- employee_benefits
DROP POLICY IF EXISTS "Accountants can view benefits" ON public.employee_benefits;
DROP POLICY IF EXISTS "Admins have full access to benefits" ON public.employee_benefits;
DROP POLICY IF EXISTS "Management has full access to benefits" ON public.employee_benefits;

-- employee_documents
DROP POLICY IF EXISTS "Accountants can view documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Admins have full access to documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Management has full access to documents" ON public.employee_documents;

-- employee_incidents
DROP POLICY IF EXISTS "Admins have full access to incidents" ON public.employee_incidents;
DROP POLICY IF EXISTS "Management has full access to incidents" ON public.employee_incidents;

-- employee_loans
DROP POLICY IF EXISTS "Accountants can manage employee loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Admins have full access to employee loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Management has full access to employee loans" ON public.employee_loans;

-- employee_salary_history
DROP POLICY IF EXISTS "Accountant full access" ON public.employee_salary_history;
DROP POLICY IF EXISTS "Admins have full access to salary history" ON public.employee_salary_history;
DROP POLICY IF EXISTS "Management has full access to salary history" ON public.employee_salary_history;

-- employee_timesheets
DROP POLICY IF EXISTS "Accountants can update timesheets" ON public.employee_timesheets;
DROP POLICY IF EXISTS "Accountants can view timesheets" ON public.employee_timesheets;
DROP POLICY IF EXISTS "Admins have full access to timesheets" ON public.employee_timesheets;
DROP POLICY IF EXISTS "Management has full access to timesheets" ON public.employee_timesheets;

-- employee_vacations
DROP POLICY IF EXISTS "Accountants can view vacations" ON public.employee_vacations;
DROP POLICY IF EXISTS "Admins have full access to vacations" ON public.employee_vacations;
DROP POLICY IF EXISTS "Management has full access to vacations" ON public.employee_vacations;
DROP POLICY IF EXISTS "Supervisor can view vacations for schedule" ON public.employee_vacations;

-- employees
DROP POLICY IF EXISTS "Accountants can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins have full access to employees" ON public.employees;
DROP POLICY IF EXISTS "Management has full access to employees" ON public.employees;
DROP POLICY IF EXISTS "Supervisor can view employees for schedule" ON public.employees;

-- farms
DROP POLICY IF EXISTS "Accountants can view farms" ON public.farms;
DROP POLICY IF EXISTS "Admins have full access to farms" ON public.farms;
DROP POLICY IF EXISTS "Management has full access to farms" ON public.farms;
DROP POLICY IF EXISTS "Supervisors can view farms" ON public.farms;
DROP POLICY IF EXISTS "Viewers can view farms" ON public.farms;

-- fields
DROP POLICY IF EXISTS "Accountants can view fields" ON public.fields;
DROP POLICY IF EXISTS "Admins have full access to fields" ON public.fields;
DROP POLICY IF EXISTS "Management has full access to fields" ON public.fields;
DROP POLICY IF EXISTS "Supervisors can view fields" ON public.fields;
DROP POLICY IF EXISTS "Viewers can view fields" ON public.fields;

-- fuel_equipment
DROP POLICY IF EXISTS "Accountants can update fuel equipment" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Accountants can view fuel equipment" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Admins have full access to fuel equipment" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Drivers can read tractors" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Management has full access to fuel equipment" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Supervisors have full access to fuel equipment" ON public.fuel_equipment;
DROP POLICY IF EXISTS "Viewers can view fuel equipment" ON public.fuel_equipment;

-- fuel_tanks
DROP POLICY IF EXISTS "Accountants can update fuel tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Accountants can view fuel tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Admins have full access to fuel tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Drivers can read agriculture tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Management has full access to fuel tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Supervisors have full access to fuel tanks" ON public.fuel_tanks;
DROP POLICY IF EXISTS "Viewers can view fuel tanks" ON public.fuel_tanks;

-- fuel_transactions
DROP POLICY IF EXISTS "Accountants can update fuel transactions" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Accountants can view fuel transactions" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Admins have full access to fuel transactions" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Management has full access to fuel transactions" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Supervisors have full access to fuel transactions" ON public.fuel_transactions;
DROP POLICY IF EXISTS "Viewers can view fuel transactions" ON public.fuel_transactions;

-- implements
DROP POLICY IF EXISTS "Accountants can update implements" ON public.implements;
DROP POLICY IF EXISTS "Accountants can view implements" ON public.implements;
DROP POLICY IF EXISTS "Admins have full access to implements" ON public.implements;
DROP POLICY IF EXISTS "Management has full access to implements" ON public.implements;
DROP POLICY IF EXISTS "Supervisors have full access to implements" ON public.implements;
DROP POLICY IF EXISTS "Viewers can view implements" ON public.implements;

-- inventory_items
DROP POLICY IF EXISTS "Accountants can update inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Accountants can view inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins have full access to inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Management has full access to inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Supervisors have full access to inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Viewers can view inventory items" ON public.inventory_items;

-- inventory_purchases
DROP POLICY IF EXISTS "Accountants can update inventory purchases" ON public.inventory_purchases;
DROP POLICY IF EXISTS "Accountants can view inventory purchases" ON public.inventory_purchases;
DROP POLICY IF EXISTS "Admins have full access to inventory purchases" ON public.inventory_purchases;
DROP POLICY IF EXISTS "Management has full access to inventory purchases" ON public.inventory_purchases;
DROP POLICY IF EXISTS "Supervisors have full access to inventory purchases" ON public.inventory_purchases;
DROP POLICY IF EXISTS "Viewers can view inventory purchases" ON public.inventory_purchases;

-- jornaleros
DROP POLICY IF EXISTS "Accountant can view jornaleros" ON public.jornaleros;
DROP POLICY IF EXISTS "Admin and management full access to jornaleros" ON public.jornaleros;
DROP POLICY IF EXISTS "Supervisor full access to jornaleros" ON public.jornaleros;

-- operation_inputs
DROP POLICY IF EXISTS "Accountants can delete operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Accountants can update operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Accountants can view operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Admins have full access to operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Management has full access to operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Supervisors have full access to operation_inputs" ON public.operation_inputs;
DROP POLICY IF EXISTS "Viewers can view operation_inputs" ON public.operation_inputs;

-- operations
DROP POLICY IF EXISTS "Accountants can update operations" ON public.operations;
DROP POLICY IF EXISTS "Accountants can view operations" ON public.operations;
DROP POLICY IF EXISTS "Admins have full access to operations" ON public.operations;
DROP POLICY IF EXISTS "Management has full access to operations" ON public.operations;
DROP POLICY IF EXISTS "Supervisors have full access to operations" ON public.operations;
DROP POLICY IF EXISTS "Viewers can view operations" ON public.operations;

-- payroll_periods
DROP POLICY IF EXISTS "Accountants can view periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Admins have full access to periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Management has full access to periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Supervisor can view" ON public.payroll_periods;

-- pending_fuel_submissions
DROP POLICY IF EXISTS "Admins can manage pending submissions" ON public.pending_fuel_submissions;
DROP POLICY IF EXISTS "Drivers can read own pending submissions" ON public.pending_fuel_submissions;
DROP POLICY IF EXISTS "Drivers can insert pending submissions" ON public.pending_fuel_submissions;

-- period_employee_benefits
DROP POLICY IF EXISTS "Accountants can update period benefits" ON public.period_employee_benefits;
DROP POLICY IF EXISTS "Accountants can view period benefits" ON public.period_employee_benefits;
DROP POLICY IF EXISTS "Admins have full access to period benefits" ON public.period_employee_benefits;
DROP POLICY IF EXISTS "Management has full access to period benefits" ON public.period_employee_benefits;

-- service_contract_entries
DROP POLICY IF EXISTS "Accountants can view contract entries" ON public.service_contract_entries;
DROP POLICY IF EXISTS "Admins have full access to contract entries" ON public.service_contract_entries;
DROP POLICY IF EXISTS "Management has full access to contract entries" ON public.service_contract_entries;
DROP POLICY IF EXISTS "Supervisors have full access to contract entries" ON public.service_contract_entries;
DROP POLICY IF EXISTS "Viewers can view contract entries" ON public.service_contract_entries;

-- service_contract_line_items
DROP POLICY IF EXISTS "Accountants can view contract line items" ON public.service_contract_line_items;
DROP POLICY IF EXISTS "Admins have full access to contract line items" ON public.service_contract_line_items;
DROP POLICY IF EXISTS "Management has full access to contract line items" ON public.service_contract_line_items;
DROP POLICY IF EXISTS "Supervisors have full access to contract line items" ON public.service_contract_line_items;
DROP POLICY IF EXISTS "Viewers can view contract line items" ON public.service_contract_line_items;

-- service_contract_payments
DROP POLICY IF EXISTS "Accountants can view contract payments" ON public.service_contract_payments;
DROP POLICY IF EXISTS "Admins have full access to contract payments" ON public.service_contract_payments;
DROP POLICY IF EXISTS "Management has full access to contract payments" ON public.service_contract_payments;
DROP POLICY IF EXISTS "Supervisors have full access to contract payments" ON public.service_contract_payments;
DROP POLICY IF EXISTS "Viewers can view contract payments" ON public.service_contract_payments;

-- service_contracts
DROP POLICY IF EXISTS "Accountants can view service contracts" ON public.service_contracts;
DROP POLICY IF EXISTS "Admins have full access to service contracts" ON public.service_contracts;
DROP POLICY IF EXISTS "Management has full access to service contracts" ON public.service_contracts;
DROP POLICY IF EXISTS "Supervisors have full access to service contracts" ON public.service_contracts;
DROP POLICY IF EXISTS "Viewers can view service contracts" ON public.service_contracts;

-- tractor_maintenance
DROP POLICY IF EXISTS "Accountants can view tractor maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Admins have full access to tractor maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Management has full access to tractor maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Supervisors have full access to tractor maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Viewers can view tractor maintenance" ON public.tractor_maintenance;

-- transaction_attachments
DROP POLICY IF EXISTS "Accountants can view attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Admins have full access to attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Management has full access to attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "Viewers can view attachments" ON public.transaction_attachments;

-- transactions
DROP POLICY IF EXISTS "Accountants can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Accountants can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Management has full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Viewers can view transactions" ON public.transactions;

-- ============================================================
-- BUG 4: Add entity_id to industrial tables
-- ============================================================

ALTER TABLE public.industrial_carretas 
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) DEFAULT current_user_entity_id();

ALTER TABLE public.industrial_plant_hours 
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) DEFAULT current_user_entity_id();

ALTER TABLE public.industrial_trucks 
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) DEFAULT current_user_entity_id();

UPDATE public.industrial_carretas SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.industrial_plant_hours SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.industrial_trucks SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;

-- Drop existing open policies on industrial tables
DROP POLICY IF EXISTS "Authenticated users can view carretas" ON public.industrial_carretas;
DROP POLICY IF EXISTS "Authenticated users can insert carretas" ON public.industrial_carretas;
DROP POLICY IF EXISTS "Authenticated users can update carretas" ON public.industrial_carretas;
DROP POLICY IF EXISTS "Authenticated users can delete carretas" ON public.industrial_carretas;
DROP POLICY IF EXISTS "Admin and Supervisor can manage carretas" ON public.industrial_carretas;
DROP POLICY IF EXISTS "Authenticated users can view" ON public.industrial_carretas;

DROP POLICY IF EXISTS "Authenticated users can view plant hours" ON public.industrial_plant_hours;
DROP POLICY IF EXISTS "Authenticated users can insert plant hours" ON public.industrial_plant_hours;
DROP POLICY IF EXISTS "Authenticated users can update plant hours" ON public.industrial_plant_hours;
DROP POLICY IF EXISTS "Authenticated users can delete plant hours" ON public.industrial_plant_hours;
DROP POLICY IF EXISTS "Admin and Supervisor can manage plant hours" ON public.industrial_plant_hours;
DROP POLICY IF EXISTS "Authenticated users can view" ON public.industrial_plant_hours;

DROP POLICY IF EXISTS "Authenticated users can view trucks" ON public.industrial_trucks;
DROP POLICY IF EXISTS "Authenticated users can insert trucks" ON public.industrial_trucks;
DROP POLICY IF EXISTS "Authenticated users can update trucks" ON public.industrial_trucks;
DROP POLICY IF EXISTS "Authenticated users can delete trucks" ON public.industrial_trucks;
DROP POLICY IF EXISTS "Admin and Supervisor can manage trucks" ON public.industrial_trucks;
DROP POLICY IF EXISTS "Authenticated users can view" ON public.industrial_trucks;

-- Entity-scoped policies for industrial_carretas
CREATE POLICY "entity_admin_carretas" ON public.industrial_carretas FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));
CREATE POLICY "entity_mgmt_carretas" ON public.industrial_carretas FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));
CREATE POLICY "entity_supervisor_carretas" ON public.industrial_carretas FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));
CREATE POLICY "entity_viewer_carretas" ON public.industrial_carretas FOR SELECT TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id));

-- Entity-scoped policies for industrial_plant_hours
CREATE POLICY "entity_admin_plant_hours" ON public.industrial_plant_hours FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));
CREATE POLICY "entity_mgmt_plant_hours" ON public.industrial_plant_hours FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));
CREATE POLICY "entity_supervisor_plant_hours" ON public.industrial_plant_hours FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));
CREATE POLICY "entity_viewer_plant_hours" ON public.industrial_plant_hours FOR SELECT TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id));

-- Entity-scoped policies for industrial_trucks
CREATE POLICY "entity_admin_trucks" ON public.industrial_trucks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));
CREATE POLICY "entity_mgmt_trucks" ON public.industrial_trucks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));
CREATE POLICY "entity_supervisor_trucks" ON public.industrial_trucks FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));
CREATE POLICY "entity_viewer_trucks" ON public.industrial_trucks FOR SELECT TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id));

-- ============================================================
-- BUG 7: Tighten tractor_operators and transportation_units
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can manage tractor operators" ON public.tractor_operators;
DROP POLICY IF EXISTS "Anyone can view tractor operators" ON public.tractor_operators;
DROP POLICY IF EXISTS "Anyone can manage tractor operators" ON public.tractor_operators;
DROP POLICY IF EXISTS "allow_all_tractor_operators" ON public.tractor_operators;

CREATE POLICY "tractor_operators_select" ON public.tractor_operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "tractor_operators_write" ON public.tractor_operators FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role) OR 
    public.has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role) OR 
    public.has_role(auth.uid(), 'supervisor'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can manage transportation units" ON public.transportation_units;
DROP POLICY IF EXISTS "Anyone can view transportation units" ON public.transportation_units;
DROP POLICY IF EXISTS "Anyone can manage transportation units" ON public.transportation_units;
DROP POLICY IF EXISTS "allow_all_transportation_units" ON public.transportation_units;

CREATE POLICY "transportation_units_select" ON public.transportation_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "transportation_units_write" ON public.transportation_units FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role) OR 
    public.has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'management'::app_role) OR 
    public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- Re-add entity-scoped driver insert policy for pending_fuel_submissions
CREATE POLICY "entity_driver_insert_pending" ON public.pending_fuel_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'driver'::app_role) AND submitted_by = auth.uid()
  );
