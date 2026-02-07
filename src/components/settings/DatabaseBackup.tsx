import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

// Tables to export (order matters for foreign key dependencies)
const TABLES_TO_EXPORT = [
  'accounts',
  'projects', 
  'cbs_codes',
  'user_roles',
  'farms',
  'fields',
  'operation_types',
  'fuel_equipment',
  'fuel_tanks',
  'implements',
  'inventory_items',
  'employees',
  'payroll_periods',
  'employee_benefits',
  'employee_documents',
  'employee_incidents',
  'employee_salary_history',
  'employee_vacations',
  'employee_loans',
  'employee_timesheets',
  'period_employee_benefits',
  'day_labor_entries',
  'day_labor_attachments',
  'transactions',
  'transaction_attachments',
  'transaction_edits',
  'fuel_transactions',
  'pending_fuel_submissions',
  'tractor_maintenance',
  'operations',
  'operation_inputs',
  'inventory_purchases',
  'service_contracts',
  'service_contract_entries',
  'service_contract_line_items',
  'service_contract_payments',
  'cronograma_weeks',
  'cronograma_entries',
  'rainfall_records',
  'jornaleros',
  'scheduled_user_deletions',
] as const;

type TableName = typeof TABLES_TO_EXPORT[number];

// Full schema definitions for recreation
const SCHEMA_SQL = `-- =============================================
-- LEDGER DR DATABASE SCHEMA
-- Generated for full system restoration
-- Version: 2.1 (Complete IT Migration Package)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  attachment_url TEXT NOT NULL,
  attachment_category TEXT NOT NULL DEFAULT 'payment_receipt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, attachment_category)
);

CREATE TABLE IF NOT EXISTS transaction_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
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
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS implements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  implement_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
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
  submitted_by TEXT,
  submission_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_fuel_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_transaction_id UUID REFERENCES fuel_transactions(id),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  photos JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tractor_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tractor_id UUID NOT NULL REFERENCES fuel_equipment(id),
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL DEFAULT 'oil_change',
  hour_meter_reading NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  hectares_done NUMERIC,
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

// RLS Policies SQL - Complete security configuration
const RLS_POLICIES_SQL = `-- =============================================
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

-- =============================================
-- ADMIN FULL ACCESS POLICIES
-- =============================================
-- Admin has full access to all tables
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
-- Accountant read access
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

-- Accountant CRUD access (create, read, update - no delete)
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

// Triggers SQL
const TRIGGERS_SQL = `-- =============================================
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
`;

// Storage configuration SQL
const STORAGE_SQL = `-- =============================================
-- STORAGE BUCKET CONFIGURATION
-- Ledger DR - File Storage Setup
-- =============================================

-- Create private storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('transaction-attachments', 'transaction-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('employee-documents', 'employee-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for transaction-attachments
CREATE POLICY "Authenticated users can upload transaction attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'transaction-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view transaction attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'transaction-attachments' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can delete transaction attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'transaction-attachments' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Storage RLS policies for employee-documents
CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can delete employee documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents' 
  AND public.has_role(auth.uid(), 'admin')
);
`;

export function DatabaseBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const fetchTableData = async (tableName: TableName) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.warn(`Error fetching ${tableName}:`, error.message);
      return [];
    }
    return data || [];
  };

  // Fetch only NCF attachments for transactions
  const fetchNCFAttachments = async () => {
    const files: { name: string; data: Blob }[] = [];
    
    try {
      // Get all NCF attachment records from database
      const { data: ncfRecords, error } = await supabase
        .from('transaction_attachments')
        .select('attachment_url')
        .eq('attachment_category', 'ncf');
      
      if (error || !ncfRecords) {
        console.warn('Error fetching NCF records:', error?.message);
        return files;
      }
      
      // Extract file paths and download each
      for (const record of ncfRecords) {
        if (!record.attachment_url) continue;
        
        // Extract path from the stored URL (e.g., "transaction-attachments/receipts/filename.jpg")
        const match = record.attachment_url.match(/transaction-attachments\/(.+)$/);
        if (!match) continue;
        
        const filePath = match[1];
        
        try {
          const { data, error: downloadError } = await supabase.storage
            .from('transaction-attachments')
            .download(filePath);
          
          if (data && !downloadError) {
            files.push({ name: filePath, data });
          }
        } catch (e) {
          console.warn(`Skipping NCF file ${filePath}:`, e);
        }
      }
    } catch (e) {
      console.warn('Error fetching NCF attachments:', e);
    }
    
    return files;
  };

  const fetchStorageFiles = async (bucketName: string) => {
    const files: { name: string; data: Blob }[] = [];
    
    // Recursive function to list all files including subdirectories
    const listFilesRecursively = async (path: string): Promise<{ name: string; fullPath: string }[]> => {
      const allFiles: { name: string; fullPath: string }[] = [];
      
      try {
        const { data: items, error } = await supabase.storage
          .from(bucketName)
          .list(path, { limit: 1000 });
        
        if (error || !items) {
          console.warn(`Error listing ${bucketName}/${path}:`, error?.message);
          return allFiles;
        }

        for (const item of items) {
          if (!item.name) continue;
          
          const fullPath = path ? `${path}/${item.name}` : item.name;
          
          // Check if this is a folder (no metadata.size means it's a folder)
          if (item.metadata === null || item.id === null) {
            // It's a folder - recurse into it
            const subFiles = await listFilesRecursively(fullPath);
            allFiles.push(...subFiles);
          } else {
            // It's a file
            allFiles.push({ name: item.name, fullPath });
          }
        }
      } catch (e) {
        console.warn(`Error listing path ${path} in ${bucketName}:`, e);
      }
      
      return allFiles;
    };

    try {
      // Get all files recursively starting from root
      const allFilesList = await listFilesRecursively('');
      
      // Download each file
      for (const file of allFilesList) {
        try {
          const { data, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(file.fullPath);
          
          if (data && !downloadError) {
            files.push({ name: file.fullPath, data });
          } else if (downloadError) {
            console.warn(`Error downloading ${file.fullPath}:`, downloadError.message);
          }
        } catch (e) {
          console.warn(`Skipping file ${file.fullPath}:`, e);
        }
      }
    } catch (e) {
      console.warn(`Error accessing bucket ${bucketName}:`, e);
    }
    
    return files;
  };

  const generateSQLInserts = (tableName: string, data: Record<string, unknown>[]) => {
    if (data.length === 0) return `-- Table: ${tableName}\n-- No data\n\n`;
    
    const columns = Object.keys(data[0]);
    let sql = `-- Table: ${tableName}\n-- ${data.length} rows\n\n`;
    
    for (const row of data) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += '\n';
    return sql;
  };

  const { t, language } = useLanguage();

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    const zip = new JSZip();
    
    try {
      const totalSteps = TABLES_TO_EXPORT.length + 3; // tables + schema + attachments + finalize
      let completedSteps = 0;

      // Step 1: Add all schema files
      setCurrentStep(t("backup.generatingSchema"));
      zip.file('00_schema.sql', SCHEMA_SQL);
      zip.file('02_rls_policies.sql', RLS_POLICIES_SQL);
      zip.file('03_triggers.sql', TRIGGERS_SQL);
      zip.file('04_storage.sql', STORAGE_SQL);
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);

      // Step 2: Fetch all table data
      let dataSQL = `-- =============================================
-- DATA INSERTS
-- Generated: ${new Date().toISOString()}
-- =============================================

`;
      const allData: Record<string, unknown[]> = {};
      
      for (const tableName of TABLES_TO_EXPORT) {
        setCurrentStep(t("backup.exportingTable").replace("{table}", tableName));
        const data = await fetchTableData(tableName);
        allData[tableName] = data;
        dataSQL += generateSQLInserts(tableName, data as Record<string, unknown>[]);
        completedSteps++;
        setProgress((completedSteps / totalSteps) * 100);
      }
      
      zip.file('01_data.sql', dataSQL);
      zip.file('backup.json', JSON.stringify(allData, null, 2));
      
      // Individual table JSON files
      const jsonFolder = zip.folder('tables');
      for (const [tableName, data] of Object.entries(allData)) {
        jsonFolder?.file(`${tableName}.json`, JSON.stringify(data, null, 2));
      }

      // Step 3: Fetch attachments (NCF only for transactions)
      setCurrentStep(t("backup.downloadingAttachments"));
      const attachmentsFolder = zip.folder('attachments');
      
      // Only fetch NCF attachments for transactions
      const ncfAttachments = await fetchNCFAttachments();
      for (const file of ncfAttachments) {
        attachmentsFolder?.file(`transactions/${file.name}`, file.data);
      }
      
      const employeeDocuments = await fetchStorageFiles('employee-documents');
      for (const file of employeeDocuments) {
        attachmentsFolder?.file(`employees/${file.name}`, file.data);
      }
      completedSteps++;
      setProgress((completedSteps / totalSteps) * 100);

      // Add metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        application: "Ledger DR - Agricultural Farm Management",
        version: "2.1",
        migrationPackage: "Complete IT Migration Package",
        tables: Object.entries(allData).map(([name, data]) => ({
          name,
          rowCount: data.length,
        })),
        totalRows: Object.values(allData).reduce((sum, data) => sum + data.length, 0),
        attachments: {
          transactions: ncfAttachments.length,
          employees: employeeDocuments.length,
        },
        sqlFiles: [
          "00_schema.sql - Tables, enums, and functions",
          "01_data.sql - INSERT statements for all data",
          "02_rls_policies.sql - Row Level Security policies",
          "03_triggers.sql - Database triggers",
          "04_storage.sql - Storage bucket configuration",
        ],
        restorationInstructions: [
          "1. Create a new PostgreSQL database (v14+)",
          "2. Run 00_schema.sql to create all tables and functions",
          "3. Run 02_rls_policies.sql to enable security policies",
          "4. Run 03_triggers.sql to set up triggers",
          "5. Run 04_storage.sql to configure storage buckets (Supabase only)",
          "6. Run 01_data.sql to insert all data",
          "7. Upload files from attachments/ folder to your storage solution",
          "8. Update attachment URLs if storage paths change",
          "9. Configure user authentication (Supabase Auth or your SSO)",
          "10. Create initial admin user in user_roles table",
        ],
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      // Add restoration readme with complete IT instructions
      zip.file('README.md', `# Ledger DR Database Backup
## Complete IT Migration Package

**Export Date:** ${new Date().toISOString()}
**Version:** 2.1

---

## Package Contents

### SQL Scripts (Execute in Order)

| File | Description |
|------|-------------|
| \`00_schema.sql\` | Complete database schema: tables, enums, and functions |
| \`01_data.sql\` | All data as INSERT statements (${metadata.totalRows.toLocaleString()} rows) |
| \`02_rls_policies.sql\` | Row Level Security policies for all tables |
| \`03_triggers.sql\` | Database triggers (updated_at, sync functions) |
| \`04_storage.sql\` | Storage bucket configuration (Supabase-specific) |

### Data Files

| File/Folder | Description |
|-------------|-------------|
| \`backup.json\` | Complete data in JSON format |
| \`tables/\` | Individual JSON files per table |
| \`attachments/\` | NCF attachments only (${ncfAttachments.length + employeeDocuments.length} files) |
| \`metadata.json\` | Export summary and statistics |

---

## Restoration Steps

### For Supabase (Recommended)

1. Create a new Supabase project
2. Go to SQL Editor and run scripts in order:
   - \`00_schema.sql\`
   - \`02_rls_policies.sql\`
   - \`03_triggers.sql\`
   - \`04_storage.sql\`
   - \`01_data.sql\`
3. Upload \`attachments/\` contents to Storage buckets
4. Configure authentication and create admin user

### For Standalone PostgreSQL

1. Create database: \`CREATE DATABASE ledger_dr;\`
2. Run \`00_schema.sql\` and \`03_triggers.sql\`
3. Skip \`02_rls_policies.sql\` and \`04_storage.sql\` (Supabase-specific)
4. Run \`01_data.sql\` to insert data
5. Set up your own file storage solution
6. Update \`attachment_url\` columns with new storage paths
7. Implement your own authentication system

---

## Security Architecture

### Roles

| Role | Access Level |
|------|-------------|
| admin | Full system access |
| management | Full operational access |
| supervisor | Operations, scheduling, fuel management |
| accountant | Financial transactions, payroll |
| viewer | Read-only access |
| driver | Fuel submissions only |

### RLS Pattern

All policies use \`public.has_role(auth.uid(), 'role_name')\` for access control.
The \`has_role()\` function is \`SECURITY DEFINER\` to prevent RLS bypass.

---

## Authentication Migration

If replacing Supabase Auth with SSO:

1. Replace \`auth.uid()\` references in RLS policies with your identity provider's user ID
2. Modify \`user_roles\` table to reference your user directory
3. Update \`has_role()\` and \`get_user_role()\` functions
4. Refactor frontend \`AuthContext.tsx\` for your SSO provider

---

## Statistics

- **Total Rows:** ${metadata.totalRows.toLocaleString()}
- **Tables:** ${metadata.tables.length}
- **NCF Attachments:** ${ncfAttachments.length}
- **Employee Documents:** ${employeeDocuments.length}

---

## Required Secrets (for edge functions)

| Secret | Purpose |
|--------|---------|
| SUPABASE_URL | Database connection |
| SUPABASE_ANON_KEY | Client-side API access |
| SUPABASE_SERVICE_ROLE_KEY | Admin operations |

---

*Generated by Ledger DR Backup System v2.1*
`);

      // Generate and download
      setCurrentStep(t("backup.generatingZip"));
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-full-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      const totalFiles = ncfAttachments.length + employeeDocuments.length;
      toast.success(
        t("backup.complete")
          .replace("{rows}", metadata.totalRows.toLocaleString(language === 'es' ? 'es-DO' : 'en-US'))
          .replace("{files}", totalFiles.toString())
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t("backup.error"));
    } finally {
      setIsExporting(false);
      setCurrentStep("");
      setProgress(0);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{t("backup.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("backup.subtitle")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">{t("backup.includesAll")}</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>{t("backup.schemaComplete")}</li>
                <li>{t("backup.allDataFrom").replace("{count}", TABLES_TO_EXPORT.length.toString())}</li>
                <li>{t("backup.attachments")}</li>
                <li>{t("backup.instructions")}</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t("backup.zipContains")}
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>00_schema.sql</strong> - {t("backup.schemaFile")}</li>
          <li><strong>01_data.sql</strong> - {t("backup.dataFile")}</li>
          <li><strong>backup.json</strong> - {t("backup.jsonFile")}</li>
          <li><strong>attachments/</strong> - {t("backup.attachmentsFolder")}</li>
          <li><strong>README.md</strong> - {t("backup.readmeFile")}</li>
        </ul>

        <p className="text-xs text-muted-foreground italic">
          {t("backup.estimatedSize")}
        </p>
        
        {isExporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{currentStep}</p>
          </div>
        )}
        
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="mt-4"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("backup.exporting")} {Math.round(progress)}%
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {t("backup.downloadBackup")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
