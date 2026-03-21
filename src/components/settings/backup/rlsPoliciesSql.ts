// RLS Policies SQL - Complete security configuration
export const RLS_POLICIES_SQL = `-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- Ledger DR - Complete RLS Configuration
-- =============================================

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_labor_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornaleros ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_fuel_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tractor_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contract_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contract_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_user_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADMIN FULL ACCESS POLICIES
-- =============================================
CREATE POLICY "Admin full access" ON accounts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON projects FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON cbs_codes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON transaction_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON transaction_edits FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employees FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_timesheets FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_benefits FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON period_employee_benefits FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_salary_history FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_vacations FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_documents FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_incidents FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON employee_loans FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON day_labor_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON day_labor_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON jornaleros FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON farms FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON fields FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON operation_types FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON operations FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON operation_inputs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON fuel_equipment FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON fuel_tanks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON fuel_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON pending_fuel_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON tractor_maintenance FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON service_contracts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON service_contract_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON service_contract_line_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON service_contract_payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON inventory_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON inventory_purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON cronograma_weeks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON cronograma_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON rainfall_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON scheduled_user_deletions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON payroll_snapshots FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON chart_of_accounts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON accounting_periods FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON journals FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON journal_lines FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access" ON fixed_assets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MANAGEMENT FULL ACCESS POLICIES
-- =============================================
CREATE POLICY "Management full access" ON accounts FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON projects FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON cbs_codes FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON transactions FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON transaction_attachments FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON transaction_edits FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employees FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_timesheets FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_benefits FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON period_employee_benefits FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_salary_history FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_vacations FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_documents FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_incidents FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON employee_loans FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON day_labor_entries FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON day_labor_attachments FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON jornaleros FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON farms FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON fields FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON operation_types FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON operations FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON operation_inputs FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON fuel_equipment FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON fuel_tanks FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON fuel_transactions FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON pending_fuel_submissions FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON tractor_maintenance FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON service_contracts FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON service_contract_entries FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON service_contract_line_items FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON service_contract_payments FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON inventory_items FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON inventory_purchases FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON cronograma_weeks FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON cronograma_entries FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON rainfall_records FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON payroll_snapshots FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON chart_of_accounts FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON accounting_periods FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON journals FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON journal_lines FOR ALL USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Management full access" ON fixed_assets FOR ALL USING (public.has_role(auth.uid(), 'management'));

-- Transaction audit log (read-only for management/accountant, full for admin)
ALTER TABLE transaction_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON transaction_audit_log FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Management can view audit log" ON transaction_audit_log FOR SELECT USING (public.has_role(auth.uid(), 'management'));
CREATE POLICY "Accountant can view audit log" ON transaction_audit_log FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

-- =============================================
-- SUPERVISOR ACCESS POLICIES
-- =============================================
CREATE POLICY "Supervisor full access" ON operations FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON operation_inputs FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON fuel_transactions FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON tractor_maintenance FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON cronograma_weeks FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON cronograma_entries FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON rainfall_records FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor full access" ON day_labor_entries FOR ALL USING (public.has_role(auth.uid(), 'supervisor'));

-- Supervisor read-only access
CREATE POLICY "Supervisor can view" ON accounts FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON farms FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON fields FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON operation_types FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON fuel_equipment FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON fuel_tanks FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON implements FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON inventory_items FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON employees FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON jornaleros FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisor can view" ON tractor_maintenance FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));

-- =============================================
-- ACCOUNTANT ACCESS POLICIES
-- =============================================
CREATE POLICY "Accountant can view" ON accounts FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON projects FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON cbs_codes FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON employees FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON payroll_periods FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON employee_benefits FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON employee_vacations FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON employee_documents FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON farms FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON fields FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON operation_types FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON tractor_maintenance FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant can view" ON payroll_snapshots FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

-- Accountant CRUD access
CREATE POLICY "Accountant full access" ON transactions FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON transaction_attachments FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON transaction_edits FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON employee_timesheets FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON period_employee_benefits FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON day_labor_entries FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON day_labor_attachments FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON operations FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON operation_inputs FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON fuel_equipment FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON fuel_tanks FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON fuel_transactions FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON implements FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON inventory_items FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON inventory_purchases FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON service_contracts FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON service_contract_entries FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON service_contract_line_items FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON service_contract_payments FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON cronograma_weeks FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON cronograma_entries FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON rainfall_records FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON jornaleros FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON employee_loans FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON chart_of_accounts FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON accounting_periods FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON journals FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON journal_lines FOR ALL USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountant full access" ON fixed_assets FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

-- =============================================
-- VIEWER ACCESS POLICIES (Read-only)
-- =============================================
CREATE POLICY "Viewer can view" ON accounts FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON projects FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON cbs_codes FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON transactions FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON transaction_attachments FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON employees FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON employee_timesheets FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON payroll_periods FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON farms FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON fields FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON operations FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON fuel_equipment FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON fuel_tanks FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON fuel_transactions FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON inventory_items FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON tractor_maintenance FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON chart_of_accounts FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON accounting_periods FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON journals FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON journal_lines FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Viewer can view" ON fixed_assets FOR SELECT USING (public.has_role(auth.uid(), 'viewer'));

-- =============================================
-- DRIVER ACCESS POLICIES
-- =============================================
CREATE POLICY "Driver can view tanks" ON fuel_tanks FOR SELECT USING (public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Driver can view equipment" ON fuel_equipment FOR SELECT USING (public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Driver can insert fuel transactions" ON fuel_transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'driver'));
CREATE POLICY "Driver can manage pending submissions" ON pending_fuel_submissions FOR ALL USING (public.has_role(auth.uid(), 'driver'));

-- User can view own role
CREATE POLICY "Users can view own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);
`;
