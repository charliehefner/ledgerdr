-- Add RLS policies for new roles: management, supervisor, viewer
-- Management has same access as admin except settings-related tables
-- Supervisor has access to operational tables (inventory, fuel, equipment, operations)
-- Viewer has read-only access to their allowed sections

-- ============================================
-- ACCOUNTS (financial) - management, viewer can read
-- ============================================
CREATE POLICY "Management has full access to accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- CBS_CODES (financial) - management, viewer can read
-- ============================================
CREATE POLICY "Management has full access to cbs_codes" ON public.cbs_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view cbs_codes" ON public.cbs_codes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- PROJECTS (financial) - management, viewer can read
-- ============================================
CREATE POLICY "Management has full access to projects" ON public.projects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- TRANSACTIONS - management full, viewer read
-- ============================================
CREATE POLICY "Management has full access to transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- TRANSACTION_ATTACHMENTS - management full, viewer read
-- ============================================
CREATE POLICY "Management has full access to attachments" ON public.transaction_attachments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view attachments" ON public.transaction_attachments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- TRANSACTION_EDITS - management full, viewer read
-- ============================================
CREATE POLICY "Management has full access to edits" ON public.transaction_edits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Viewers can view edits" ON public.transaction_edits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- HR TABLES - management full, accountant already has access
-- ============================================
-- employees
CREATE POLICY "Management has full access to employees" ON public.employees
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_benefits
CREATE POLICY "Management has full access to benefits" ON public.employee_benefits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_documents
CREATE POLICY "Management has full access to documents" ON public.employee_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_incidents
CREATE POLICY "Management has full access to incidents" ON public.employee_incidents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_salary_history
CREATE POLICY "Management has full access to salary history" ON public.employee_salary_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_timesheets
CREATE POLICY "Management has full access to timesheets" ON public.employee_timesheets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- employee_vacations
CREATE POLICY "Management has full access to vacations" ON public.employee_vacations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- payroll_periods
CREATE POLICY "Management has full access to periods" ON public.payroll_periods
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- period_employee_benefits
CREATE POLICY "Management has full access to period benefits" ON public.period_employee_benefits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- day_labor_entries
CREATE POLICY "Management has full access to day labor entries" ON public.day_labor_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

-- ============================================
-- INVENTORY TABLES - management full, supervisor full, viewer read
-- ============================================
-- inventory_items
CREATE POLICY "Management has full access to inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view inventory items" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- inventory_purchases
CREATE POLICY "Management has full access to inventory purchases" ON public.inventory_purchases
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to inventory purchases" ON public.inventory_purchases
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view inventory purchases" ON public.inventory_purchases
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- FUEL TABLES - management full, supervisor full, viewer read
-- ============================================
-- fuel_tanks
CREATE POLICY "Management has full access to fuel tanks" ON public.fuel_tanks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to fuel tanks" ON public.fuel_tanks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view fuel tanks" ON public.fuel_tanks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- fuel_transactions
CREATE POLICY "Management has full access to fuel transactions" ON public.fuel_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to fuel transactions" ON public.fuel_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view fuel transactions" ON public.fuel_transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- fuel_equipment
CREATE POLICY "Management has full access to fuel equipment" ON public.fuel_equipment
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to fuel equipment" ON public.fuel_equipment
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view fuel equipment" ON public.fuel_equipment
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- IMPLEMENTS - management full, supervisor full, viewer read
-- ============================================
CREATE POLICY "Management has full access to implements" ON public.implements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to implements" ON public.implements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view implements" ON public.implements
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- ============================================
-- OPERATIONS TABLES - management full, supervisor full, viewer read
-- ============================================
-- farms
CREATE POLICY "Management has full access to farms" ON public.farms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors can view farms" ON public.farms
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view farms" ON public.farms
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- fields
CREATE POLICY "Management has full access to fields" ON public.fields
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors can view fields" ON public.fields
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view fields" ON public.fields
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- operation_types
CREATE POLICY "Management has full access to operation_types" ON public.operation_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors can view operation_types" ON public.operation_types
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view operation_types" ON public.operation_types
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- operations
CREATE POLICY "Management has full access to operations" ON public.operations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to operations" ON public.operations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view operations" ON public.operations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- operation_inputs
CREATE POLICY "Management has full access to operation_inputs" ON public.operation_inputs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Supervisors have full access to operation_inputs" ON public.operation_inputs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Viewers can view operation_inputs" ON public.operation_inputs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));