// Full schema definitions for recreation
// NOTE: Keep in sync with actual database schema when migrations are applied
export const SCHEMA_SQL = `-- =============================================
-- LEDGER DR DATABASE SCHEMA
-- Generated for full system restoration
-- Version: 2.2 (Complete IT Migration Package)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'accountant', 'management', 'supervisor', 'viewer', 'driver');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_function AS ENUM (
    'fertilizer', 'fuel', 'pre_emergent_herbicide', 'post_emergent_herbicide',
    'pesticide', 'fungicide', 'insecticide', 'seed', 'other', 'condicionador', 'adherente'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- CORE FINANCIAL TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  english_description TEXT NOT NULL,
  spanish_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  english_description TEXT NOT NULL,
  spanish_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cbs_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  english_description TEXT NOT NULL,
  spanish_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id INTEGER,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'DOP',
  itbis NUMERIC,
  itbis_retenido NUMERIC DEFAULT 0,
  isr_retenido NUMERIC DEFAULT 0,
  name TEXT,
  rnc TEXT,
  document TEXT,
  pay_method TEXT,
  master_acct_code TEXT,
  cbs_code TEXT,
  project_code TEXT,
  comments TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  is_void BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  cost_center TEXT NOT NULL DEFAULT 'general',
  transaction_direction TEXT DEFAULT 'purchase',
  dgii_tipo_bienes_servicios TEXT,
  dgii_tipo_ingreso TEXT,
  dgii_tipo_anulacion TEXT,
  account_id UUID,
  project_id UUID,
  cbs_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  attachment_url TEXT NOT NULL,
  attachment_category TEXT NOT NULL DEFAULT 'payment_receipt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, attachment_category)
);

CREATE TABLE IF NOT EXISTS transaction_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- HR TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'Obrero',
  salary NUMERIC NOT NULL DEFAULT 0,
  date_of_hire DATE NOT NULL,
  date_of_birth DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bank TEXT,
  bank_account_number TEXT,
  shirt_size TEXT,
  pant_size TEXT,
  boot_size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours_worked NUMERIC,
  is_absent BOOLEAN NOT NULL DEFAULT false,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  benefit_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS period_employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  benefit_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  base_pay NUMERIC NOT NULL DEFAULT 0,
  overtime_pay NUMERIC NOT NULL DEFAULT 0,
  holiday_pay NUMERIC NOT NULL DEFAULT 0,
  sunday_pay NUMERIC NOT NULL DEFAULT 0,
  total_benefits NUMERIC NOT NULL DEFAULT 0,
  tss NUMERIC NOT NULL DEFAULT 0,
  isr NUMERIC NOT NULL DEFAULT 0,
  loan_deduction NUMERIC NOT NULL DEFAULT 0,
  absence_deduction NUMERIC NOT NULL DEFAULT 0,
  vacation_deduction NUMERIC NOT NULL DEFAULT 0,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  effective_date DATE NOT NULL,
  salary NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  severity TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  loan_date DATE NOT NULL,
  loan_amount NUMERIC NOT NULL,
  number_of_payments INTEGER NOT NULL,
  payment_amount NUMERIC NOT NULL,
  remaining_payments INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_labor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  week_ending_date DATE NOT NULL,
  operation_description TEXT NOT NULL,
  field_name TEXT,
  workers_count INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_labor_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ending_date DATE NOT NULL,
  attachment_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jornaleros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- OPERATIONS & FARM TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  hectares NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_mechanical BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- EQUIPMENT TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS fuel_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  hp NUMERIC,
  current_hour_meter NUMERIC NOT NULL DEFAULT 0,
  maintenance_interval_hours INTEGER NOT NULL DEFAULT 250,
  purchase_date DATE,
  purchase_price NUMERIC,
  gpsgate_user_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS implements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  implement_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  working_width_m NUMERIC,
  purchase_date DATE,
  purchase_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fuel_tanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  use_type TEXT NOT NULL,
  fuel_type TEXT NOT NULL DEFAULT 'diesel',
  capacity_gallons NUMERIC NOT NULL,
  current_level_gallons NUMERIC NOT NULL DEFAULT 0,
  last_pump_end_reading NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fuel_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id UUID NOT NULL REFERENCES fuel_tanks(id),
  equipment_id UUID REFERENCES fuel_equipment(id),
  transaction_type TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  gallons NUMERIC NOT NULL,
  hour_meter_reading NUMERIC,
  previous_hour_meter NUMERIC,
  gallons_per_hour NUMERIC,
  pump_start_reading NUMERIC,
  pump_end_reading NUMERIC,
  notes TEXT,
  submitted_by UUID,
  submission_source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_fuel_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_transaction_id UUID REFERENCES fuel_transactions(id),
  submitted_by UUID,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  photos JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tractor_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tractor_id UUID NOT NULL REFERENCES fuel_equipment(id),
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL DEFAULT 'routine',
  hour_meter_reading NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operation_type_id UUID NOT NULL REFERENCES operation_types(id),
  field_id UUID NOT NULL REFERENCES fields(id),
  tractor_id UUID REFERENCES fuel_equipment(id),
  implement_id UUID REFERENCES implements(id),
  driver TEXT,
  start_hours NUMERIC,
  end_hours NUMERIC,
  hectares_done NUMERIC DEFAULT 0,
  workers_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SERVICE CONTRACTS TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS service_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_cedula_rnc TEXT,
  operation_type TEXT NOT NULL,
  operation_type_other TEXT,
  unit_type TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  farm_id UUID REFERENCES farms(id),
  bank TEXT,
  bank_account TEXT,
  comments TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_contract_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES service_contracts(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  units_charged NUMERIC NOT NULL DEFAULT 0,
  calculated_cost NUMERIC NOT NULL DEFAULT 0,
  cost_override NUMERIC,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_contract_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES service_contract_entries(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_contract_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES service_contracts(id),
  transaction_id TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INVENTORY TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name TEXT NOT NULL,
  molecule_name TEXT,
  cas_number TEXT,
  function inventory_function NOT NULL DEFAULT 'other',
  supplier TEXT,
  purchase_unit_type TEXT NOT NULL DEFAULT 'unit',
  purchase_unit_quantity NUMERIC NOT NULL DEFAULT 1,
  use_unit TEXT NOT NULL DEFAULT 'kg',
  sack_weight_kg NUMERIC,
  normal_dose_per_ha NUMERIC,
  price_per_purchase_unit NUMERIC NOT NULL DEFAULT 0,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC,
  co2_equivalent NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  packaging_unit TEXT NOT NULL DEFAULT 'unit',
  packaging_quantity NUMERIC NOT NULL DEFAULT 1,
  supplier TEXT,
  document_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operation_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_used NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- CRONOGRAMA TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS cronograma_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ending_date DATE NOT NULL UNIQUE,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cronograma_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ending_date DATE NOT NULL,
  worker_name TEXT NOT NULL,
  worker_id UUID,
  worker_type TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  time_slot TEXT NOT NULL,
  task TEXT,
  is_holiday BOOLEAN DEFAULT false,
  is_vacation BOOLEAN DEFAULT false,
  source_operation_id UUID REFERENCES operations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RAINFALL RECORDS
-- =============================================
CREATE TABLE IF NOT EXISTS rainfall_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date DATE NOT NULL UNIQUE,
  palmarito NUMERIC,
  solar NUMERIC,
  virgencita NUMERIC,
  caoba NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- USER MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT,
  scheduled_by UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execute_after TIMESTAMPTZ NOT NULL,
  reason TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ACCOUNTING TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_id UUID REFERENCES chart_of_accounts(id),
  allow_posting BOOLEAN DEFAULT true,
  currency VARCHAR DEFAULT 'DOP',
  base_currency VARCHAR DEFAULT 'DOP',
  english_description TEXT,
  spanish_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number TEXT,
  journal_date DATE NOT NULL,
  description TEXT,
  currency VARCHAR DEFAULT 'DOP',
  exchange_rate NUMERIC DEFAULT 1,
  posted BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  period_id UUID REFERENCES accounting_periods(id),
  transaction_source_id UUID REFERENCES transactions(id),
  reversal_of_id UUID REFERENCES journals(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID REFERENCES journals(id),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  project_code TEXT,
  cbs_code TEXT,
  tax_code_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_code TEXT,
  serial_number TEXT,
  category TEXT NOT NULL DEFAULT 'equipment',
  acquisition_value NUMERIC NOT NULL DEFAULT 0,
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  acquisition_date DATE,
  in_service_date DATE,
  disposal_date DATE,
  disposal_value NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  equipment_id UUID REFERENCES fuel_equipment(id),
  implement_id UUID REFERENCES implements(id),
  source_project_id UUID REFERENCES projects(id),
  asset_account_code TEXT,
  accumulated_depreciation_account TEXT,
  depreciation_expense_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_hours_until_maintenance(p_tractor_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_hours NUMERIC;
  v_last_maintenance_hours NUMERIC;
  v_interval INTEGER;
BEGIN
  SELECT current_hour_meter, maintenance_interval_hours
  INTO v_current_hours, v_interval
  FROM fuel_equipment WHERE id = p_tractor_id;
  
  SELECT hour_meter_reading INTO v_last_maintenance_hours
  FROM tractor_maintenance WHERE tractor_id = p_tractor_id
  ORDER BY hour_meter_reading DESC LIMIT 1;
  
  IF v_last_maintenance_hours IS NULL THEN
    v_last_maintenance_hours := 0;
  END IF;
  
  RETURN (v_interval - (v_current_hours - v_last_maintenance_hours))::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tank_last_pump_reading()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'dispense' AND NEW.pump_end_reading IS NOT NULL THEN
    UPDATE fuel_tanks 
    SET last_pump_end_reading = NEW.pump_end_reading,
        updated_at = now()
    WHERE id = NEW.tank_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_tractor_hour_meter()
RETURNS TRIGGER AS $$
DECLARE
  max_hours NUMERIC;
BEGIN
  IF NEW.tractor_id IS NOT NULL AND NEW.end_hours IS NOT NULL THEN
    SELECT COALESCE(MAX(end_hours), 0)
    INTO max_hours
    FROM operations
    WHERE tractor_id = NEW.tractor_id
      AND end_hours IS NOT NULL;
    
    UPDATE fuel_equipment
    SET current_hour_meter = max_hours,
        updated_at = now()
    WHERE id = NEW.tractor_id
      AND current_hour_meter < max_hours;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_fuel_tanks_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_use_type TEXT;
  v_total_level NUMERIC;
  v_inventory_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_use_type := OLD.use_type;
  ELSE
    v_use_type := NEW.use_type;
  END IF;
  
  SELECT COALESCE(SUM(current_level_gallons), 0)
  INTO v_total_level
  FROM fuel_tanks
  WHERE use_type = v_use_type
    AND is_active = true
    AND fuel_type = 'diesel';
  
  IF v_use_type = 'agriculture' THEN
    v_inventory_name := 'Diesel Agrícola';
  ELSIF v_use_type = 'industry' THEN
    v_inventory_name := 'Diesel Industrial';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  UPDATE inventory_items
  SET current_quantity = v_total_level,
      updated_at = now()
  WHERE commercial_name = v_inventory_name
    AND function = 'fuel';
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_accountant_only()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(auth.uid(), 'accountant') 
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'management')
$$;
`;
