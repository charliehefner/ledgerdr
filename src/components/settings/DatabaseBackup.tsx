import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { Progress } from "@/components/ui/progress";

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
  'tractor_maintenance',
  'operations',
  'operation_inputs',
  'inventory_purchases',
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
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'accountant', 'management', 'supervisor', 'viewer');
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  hectares_done NUMERIC NOT NULL,
  workers_count INTEGER,
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
  function inventory_function NOT NULL DEFAULT 'other',
  supplier TEXT,
  purchase_unit_type TEXT NOT NULL DEFAULT 'unit',
  purchase_unit_quantity NUMERIC NOT NULL DEFAULT 1,
  use_unit TEXT NOT NULL DEFAULT 'kg',
  sack_weight_kg NUMERIC,
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

-- =============================================
-- STORAGE BUCKETS (Run separately in Supabase)
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('transaction-attachments', 'transaction-attachments', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);
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

  const fetchStorageFiles = async (bucketName: string) => {
    const files: { name: string; data: Blob }[] = [];
    
    try {
      const { data: fileList, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1000 });
      
      if (error || !fileList) {
        console.warn(`Error listing ${bucketName}:`, error?.message);
        return files;
      }

      for (const file of fileList) {
        if (file.name) {
          try {
            const { data, error: downloadError } = await supabase.storage
              .from(bucketName)
              .download(file.name);
            
            if (data && !downloadError) {
              files.push({ name: file.name, data });
            }
          } catch (e) {
            console.warn(`Skipping file ${file.name}:`, e);
          }
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

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    const zip = new JSZip();
    
    try {
      const totalSteps = TABLES_TO_EXPORT.length + 3; // tables + schema + attachments + finalize
      let completedSteps = 0;

      // Step 1: Add schema
      setCurrentStep("Generando esquema de base de datos...");
      zip.file('00_schema.sql', SCHEMA_SQL);
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
        setCurrentStep(`Exportando ${tableName}...`);
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

      // Step 3: Fetch attachments
      setCurrentStep("Descargando archivos adjuntos...");
      const attachmentsFolder = zip.folder('attachments');
      const transactionAttachments = await fetchStorageFiles('transaction-attachments');
      for (const file of transactionAttachments) {
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
        version: "2.0",
        tables: Object.entries(allData).map(([name, data]) => ({
          name,
          rowCount: data.length,
        })),
        totalRows: Object.values(allData).reduce((sum, data) => sum + data.length, 0),
        attachments: {
          transactions: transactionAttachments.length,
          employees: employeeDocuments.length,
        },
        restorationInstructions: [
          "1. Create a new PostgreSQL database",
          "2. Run 00_schema.sql to create all tables and functions",
          "3. Run 01_data.sql to insert all data",
          "4. Upload files from attachments/ folder to your storage solution",
          "5. Update attachment URLs in transaction_attachments and employee_documents tables",
          "6. Configure user authentication separately",
        ],
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      
      // Add restoration readme
      zip.file('README.md', `# Ledger DR Database Backup

## Export Date: ${new Date().toISOString()}

## Contents

- **00_schema.sql** - Complete database schema (tables, enums, functions)
- **01_data.sql** - All data as INSERT statements
- **backup.json** - Complete data in JSON format
- **tables/** - Individual JSON files per table
- **attachments/** - All uploaded files (invoices, documents)
- **metadata.json** - Export summary and row counts

## Restoration Steps

1. **Create Database**: Set up a new PostgreSQL database (v14+)
2. **Run Schema**: Execute \`00_schema.sql\` to create structure
3. **Insert Data**: Execute \`01_data.sql\` to restore all data
4. **Upload Files**: Copy attachments to your storage solution
5. **Update URLs**: Adjust attachment URLs for new storage location
6. **Configure Auth**: Set up user authentication in your new environment

## Statistics

- Total Rows: ${metadata.totalRows.toLocaleString()}
- Tables: ${metadata.tables.length}
- Transaction Attachments: ${transactionAttachments.length}
- Employee Documents: ${employeeDocuments.length}
`);

      // Generate and download
      setCurrentStep("Generando archivo ZIP...");
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
      toast.success(`¡Respaldo completo! ${metadata.totalRows.toLocaleString()} filas + ${transactionAttachments.length + employeeDocuments.length} archivos exportados.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar la base de datos');
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
          <h3 className="font-semibold">Respaldo Completo de Base de Datos</h3>
          <p className="text-sm text-muted-foreground">
            Descarga un respaldo completo para migración del sistema
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Este respaldo incluye TODO lo necesario:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-300">
                <li>Esquema completo (CREATE TABLE, tipos, funciones)</li>
                <li>Todos los datos de {TABLES_TO_EXPORT.length} tablas</li>
                <li>Archivos adjuntos (facturas y documentos)</li>
                <li>Instrucciones de restauración</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          El archivo ZIP contendrá:
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>00_schema.sql</strong> - Estructura completa de la base de datos</li>
          <li><strong>01_data.sql</strong> - INSERT statements para todos los datos</li>
          <li><strong>backup.json</strong> - Todos los datos en formato JSON</li>
          <li><strong>attachments/</strong> - Todos los archivos adjuntos</li>
          <li><strong>README.md</strong> - Instrucciones de restauración</li>
        </ul>

        <p className="text-xs text-muted-foreground italic">
          Tamaño estimado: ~15-20 MB (datos + ~12 MB de archivos adjuntos)
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
              Exportando... {Math.round(progress)}%
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Descargar Respaldo Completo
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
