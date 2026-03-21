// Triggers SQL
export const TRIGGERS_SQL = `-- =============================================
-- DATABASE TRIGGERS
-- Ledger DR - Trigger Configuration
-- =============================================

-- Updated_at triggers for all tables with updated_at column
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_timesheets_updated_at
  BEFORE UPDATE ON employee_timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_benefits_updated_at
  BEFORE UPDATE ON employee_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_loans_updated_at
  BEFORE UPDATE ON employee_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_farms_updated_at
  BEFORE UPDATE ON farms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fields_updated_at
  BEFORE UPDATE ON fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fuel_equipment_updated_at
  BEFORE UPDATE ON fuel_equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_implements_updated_at
  BEFORE UPDATE ON implements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fuel_tanks_updated_at
  BEFORE UPDATE ON fuel_tanks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tractor_maintenance_updated_at
  BEFORE UPDATE ON tractor_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cronograma_weeks_updated_at
  BEFORE UPDATE ON cronograma_weeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cronograma_entries_updated_at
  BEFORE UPDATE ON cronograma_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rainfall_records_updated_at
  BEFORE UPDATE ON rainfall_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_day_labor_entries_updated_at
  BEFORE UPDATE ON day_labor_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jornaleros_updated_at
  BEFORE UPDATE ON jornaleros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_contracts_updated_at
  BEFORE UPDATE ON service_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_contract_entries_updated_at
  BEFORE UPDATE ON service_contract_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_contract_payments_updated_at
  BEFORE UPDATE ON service_contract_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fuel tank pump reading sync trigger
CREATE TRIGGER sync_tank_pump_reading
  AFTER INSERT ON fuel_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tank_last_pump_reading();

-- Tractor hour meter sync from operations
CREATE TRIGGER sync_tractor_hours
  AFTER INSERT OR UPDATE ON operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tractor_hour_meter();

-- Fuel tank to inventory sync
CREATE TRIGGER sync_fuel_to_inventory
  AFTER INSERT OR UPDATE OR DELETE ON fuel_tanks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fuel_tanks_to_inventory();

-- Validate journal balance before posting
CREATE TRIGGER validate_journal_before_post
  BEFORE UPDATE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_balance();

-- Transaction field change audit log
CREATE TRIGGER trg_log_transaction_changes
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_transaction_changes();
`;
