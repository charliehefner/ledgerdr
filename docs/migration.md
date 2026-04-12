# Technical Migration Document: LedgerDR
## From Supabase to Self-Hosted DigitalOcean

**Generated:** 2026-04-12  
**Target Environment:** DigitalOcean Managed PostgreSQL + Ubuntu Droplet + DO Spaces  
**Executor:** Claude Code (AI coding agent)  
**Status:** This document is the sole source of truth for the migration.

---

## Table of Contents

1. [Supabase Dependencies Inventory](#1-supabase-dependencies-inventory)
2. [Complete Database Schema](#2-complete-database-schema)
3. [Environment Variables & Secrets](#3-environment-variables--secrets)
4. [Authentication Architecture](#4-authentication-architecture)
5. [File Storage Usage](#5-file-storage-usage)
6. [Realtime & WebSocket Usage](#6-realtime--websocket-usage)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Third-Party Integrations](#8-third-party-integrations)
9. [Migration Risk Assessment](#9-migration-risk-assessment)
10. [Recommended Migration Sequence](#10-recommended-migration-sequence)

---

## 1. Supabase Dependencies Inventory

### 1.1 Supabase SDK Features Used

| Feature | Used | Files |
|---------|------|-------|
| `supabase.from()` (PostgREST) | ✅ | 141 files (~3000 call sites) |
| `supabase.auth.*` | ✅ | 16 files |
| `supabase.storage.*` | ✅ | 8 files |
| `supabase.functions.invoke()` | ✅ | 15 files (19 edge functions) |
| `supabase.rpc()` | ✅ | Multiple files |
| `supabase.channel()` (Realtime) | ❌ | 0 files — NOT USED |

### 1.2 Auth SDK Calls

| Method | File(s) |
|--------|---------|
| `signInWithPassword` | `src/contexts/AuthContext.tsx` |
| `signOut` | `src/contexts/AuthContext.tsx` |
| `onAuthStateChange` | `src/contexts/AuthContext.tsx` |
| `getSession` | `src/contexts/AuthContext.tsx`, `src/lib/attachments.ts`, `src/pages/ResetPassword.tsx`, `src/components/operations/FieldHistoryPanel.tsx`, `src/components/settings/GPSLinkingManager.tsx`, `src/components/alerts/useAlertData.ts`, `src/components/operations/KMLImportDialog.tsx` |
| `resetPasswordForEmail` | `src/pages/Login.tsx` |
| `updateUser` | `src/pages/ResetPassword.tsx` |
| `mfa.listFactors` | `src/components/settings/MfaSettings.tsx` |
| `mfa.enroll` | `src/components/settings/MfaSettings.tsx` |
| `mfa.challenge` | `src/components/settings/MfaSettings.tsx` |
| `mfa.verify` | `src/components/settings/MfaSettings.tsx` |
| `mfa.unenroll` | `src/components/settings/MfaSettings.tsx` |

### 1.3 Storage SDK Calls

| Bucket | Operation | File(s) |
|--------|-----------|---------|
| `transaction-attachments` | `upload` | `src/lib/storage.ts`, `src/components/transactions/AttachmentCell.tsx`, `src/components/transactions/AttachmentUpload.tsx`, `src/components/transactions/MultiAttachmentCell.tsx`, `src/components/transactions/MultiAttachmentUpload.tsx`, `src/components/hr/DayLaborAttachment.tsx` |
| `transaction-attachments` | `download` | `src/components/settings/backup/backupUtils.ts` |
| `transaction-attachments` | `list` | `src/components/settings/backup/backupUtils.ts` |
| `employee-documents` | `upload` | `src/components/hr/EmployeeDetailDialog.tsx` |
| `employee-documents` | `remove` | `src/components/hr/EmployeeDetailDialog.tsx` |

### 1.4 Edge Functions Inventory

| Function | Purpose | Secrets Required | JWT Verify |
|----------|---------|-----------------|------------|
| `ai-search` | Natural language query via Lovable AI | LOVABLE_API_KEY | true (default) |
| `analyze-meter-image` | OCR hour meter from photo via Lovable AI | LOVABLE_API_KEY | true |
| `api-proxy` | Dallas Agro API proxy | DALLAS_AGRO_API_KEY | false |
| `create-user` | Admin creates users via service role | (service_role key) | true |
| `delete-user` | Admin deletes users via service role | (service_role key) | true |
| `expire-fuel-submissions` | Cron: expire old pending fuel | (service_role key) | true |
| `fetch-exchange-rate` | Fetch USD/DOP rate from external API | None | false |
| `generate-hr-letter` | Generate HR letters via Lovable AI | LOVABLE_API_KEY | true |
| `generate-journals` | Auto-generate journal entries | (service_role key) | false |
| `get-signed-url` | Generate signed URLs for private files | (service_role key) | false |
| `get-users` | List all users (admin) | (service_role key) | true |
| `gpsgate-proxy` | GPSGate API proxy | GPSGATE_API_KEY | false |
| `import-field-boundaries` | Import KML/GeoJSON boundaries | (service_role key) | false |
| `ocr-cedula` | OCR Dominican ID card | NANONETS_API_KEY, NANONETS_MODEL_ID | false |
| `ocr-receipt` | OCR receipt scanning | NANONETS_API_KEY, NANONETS_MODEL_ID | false |
| `process-scheduled-deletions` | Cron: process scheduled user deletions | (service_role key) | true |
| `reset-user-password` | Admin resets user password | (service_role key) | false |
| `send-telegram` | Send Telegram notifications | TELEGRAM_API_KEY | true |
| `update-user-role` | Admin updates user role | (service_role key) | true |

### 1.5 RPC Functions Called from Frontend

| Function | Called From |
|----------|-------------|
| `get_user_role` | `src/contexts/AuthContext.tsx` |
| `calculate_payroll_for_period` | PayrollView |
| `calculate_prestaciones` | PrestacionesCalculatorDialog |
| `get_balance_sheet` | BalanceSheetView |
| `get_profit_loss` | ProfitLossView |
| `trial_balance` | TrialBalanceView |
| `account_balances_from_journals` | Multiple accounting views |
| `generate_dgii_606` | DGII606Table |
| `generate_dgii_607` | DGII607Table |
| `generate_dgii_608` | DGII608Table |
| `generate_tss_autodeterminacion` | TSSAutodeterminacionView |
| `close_day_labor_week` | DayLaborView |
| `count_unlinked_transactions` | useUnlinkedTransactionCount |
| `get_pending_approvals` | Approvals page |
| `approve_request` | Approvals page |
| `reject_request` | Approvals page |
| `begin_stock_count` | PhysicalCountView |
| `reconcile_stock_count` | PhysicalCountView |
| `cancel_stock_count` | PhysicalCountView |
| `create_transaction_with_ap_ar` | TransactionForm |
| `register_service_partial_payment` | ServicesView |
| `foreign_currency_balances` | FxRevaluationButton |
| `revalue_open_ap_ar` | PeriodRevaluationButton |
| `generate_closing_journal` | PeriodClosingButton |
| `generate_due_recurring_journals` | RecurringEntriesView |
| `get_cost_per_field` | CostPerFieldTab |
| `get_fields_with_boundaries` | FieldsMapView |
| `get_all_public_tables` | DatabaseBackup |
| `income_statement` | Reports |
| `income_statement_detail` | Reports |

---

## 2. Complete Database Schema

### 2.1 Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'accountant', 'management', 'supervisor', 'viewer', 'driver');
CREATE TYPE public.inventory_function AS ENUM ('fertilizer', 'fuel', 'pre_emergent_herbicide', 'post_emergent_herbicide', 'pesticide', 'fungicide', 'insecticide', 'seed', 'other', 'condicionador', 'adherente');
CREATE TYPE public.liquidation_case_status AS ENUM ('draft', 'final');
CREATE TYPE public.prestaciones_scenario AS ENUM ('desahucio', 'dimision');
```

### 2.2 Tables (93 total)

All 93 tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

Complete table list:
`accounting_audit_log`, `accounting_periods`, `advance_allocations`, `alert_configurations`, `ap_ar_document_transactions`, `ap_ar_documents`, `ap_ar_payments`, `app_error_log`, `approval_policies`, `approval_requests`, `asset_depreciation_rules`, `bank_accounts`, `bank_statement_lines`, `budget_lines`, `cbs_codes`, `chart_of_accounts`, `contact_bank_accounts`, `contacts`, `cronograma_entries`, `cronograma_weeks`, `day_labor_attachments`, `day_labor_entries`, `depreciation_schedule`, `employee_benefits`, `employee_documents`, `employee_incidents`, `employee_loans`, `employee_salary_history`, `employee_timesheets`, `employee_vacations`, `employees`, `entities`, `entity_groups`, `exchange_rates`, `farms`, `fields`, `fixed_asset_depreciation_entries`, `fixed_assets`, `fuel_equipment`, `fuel_tanks`, `fuel_transactions`, `hr_audit_log`, `implements`, `industrial_carretas`, `industrial_plant_hours`, `industrial_trucks`, `intercompany_account_config`, `intercompany_transactions`, `inventory_items`, `inventory_purchases`, `isr_brackets`, `jornaleros`, `journal_lines`, `journals`, `liquidation_cases`, `notification_settings`, `operation_followups`, `operation_inputs`, `operation_types`, `operations`, `payment_method_accounts`, `payroll_periods`, `payroll_snapshots`, `pending_fuel_submissions`, `period_employee_benefits`, `prestaciones_parameters`, `projects`, `rainfall_records`, `recurring_journal_template_lines`, `recurring_journal_templates`, `revaluation_log`, `scheduled_user_deletions`, `service_contract_entries`, `service_contract_line_items`, `service_contract_payments`, `service_contracts`, `service_entries`, `service_entry_payments`, `service_providers`, `stock_count_lines`, `stock_count_sessions`, `tax_codes`, `telegram_recipients`, `tractor_maintenance`, `tractor_operators`, `transaction_attachments`, `transaction_audit_log`, `transaction_edits`, `transactions`, `transportation_units`, `tss_parameters`, `user_roles`, `vendor_account_rules`

#### CRITICAL NOTE FOR SCHEMA EXTRACTION:
The complete column definitions for all 93 tables are available in the Supabase types file at `src/integrations/supabase/types.ts`. This file contains every column, its type, nullability, and default for Row, Insert, and Update operations. Use this as the authoritative schema reference.

**To extract CREATE TABLE SQL from the live database, run:**
```sql
SELECT 
  'CREATE TABLE public.' || c.relname || ' (' || 
  string_agg(
    a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) ||
    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN d.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END,
    ', ' ORDER BY a.attnum
  ) || ');'
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
GROUP BY c.relname
ORDER BY c.relname;
```

### 2.3 Key Table Schemas (Critical Tables)

#### user_roles
```sql
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,  -- references auth.users(id)
  role public.app_role NOT NULL,
  entity_id uuid,         -- references entities(id), NULL = global
  entity_group_id uuid,   -- references entity_groups(id)
  created_at timestamptz DEFAULT now()
);
```

#### entities
```sql
CREATE TABLE public.entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  rnc text,
  currency text DEFAULT 'DOP',
  country_code text DEFAULT 'DO',
  is_active boolean DEFAULT true,
  entity_group_id uuid,   -- references entity_groups(id)
  tss_nomina_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### transactions
```sql
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_id integer GENERATED BY DEFAULT AS IDENTITY,
  transaction_date date NOT NULL,
  master_acct_code text,
  account_id uuid,          -- FK to chart_of_accounts
  project_code text,
  project_id uuid,           -- FK to projects
  cbs_code text,
  cbs_id uuid,               -- FK to cbs_codes
  purchase_date date,
  description text NOT NULL,
  currency text DEFAULT 'DOP',
  amount numeric NOT NULL DEFAULT 0,
  itbis numeric DEFAULT 0,
  itbis_retenido numeric DEFAULT 0,
  isr_retenido numeric DEFAULT 0,
  pay_method text,
  document text,
  name text,
  rnc text,
  comments text,
  exchange_rate numeric,
  exchange_rate_used numeric,
  amount_base_currency numeric,
  cost_center text DEFAULT 'general',
  is_internal boolean DEFAULT false,
  is_void boolean DEFAULT false,
  void_reason text,
  voided_at timestamptz,
  attachment_url text,
  transaction_direction text DEFAULT 'purchase',
  destination_acct_code text,
  dgii_tipo_ingreso text,
  dgii_tipo_bienes_servicios text,
  dgii_tipo_anulacion text,
  due_date date,
  destination_amount numeric,
  itbis_override_reason text,
  approval_status text DEFAULT 'auto_approved',
  entity_id uuid NOT NULL DEFAULT current_user_entity_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### journals
```sql
CREATE TABLE public.journals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_number text,       -- auto-generated by trigger
  journal_date date NOT NULL,
  journal_type varchar(3) DEFAULT 'GJ',
  reference_number text,
  description text,
  currency varchar(3) DEFAULT 'DOP',
  exchange_rate numeric DEFAULT 1,
  posted boolean DEFAULT false,
  posted_at timestamptz,
  posted_by uuid,
  deleted_at timestamptz,
  transaction_source_id uuid,  -- FK to transactions
  reversal_of_id uuid,         -- FK to journals (self)
  period_id uuid,              -- FK to accounting_periods
  entity_id uuid,              -- FK to entities
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### journal_lines
```sql
CREATE TABLE public.journal_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_id uuid NOT NULL,    -- FK to journals
  account_id uuid NOT NULL,    -- FK to chart_of_accounts
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  description text,
  tax_code_id uuid,            -- FK to tax_codes
  project_code text,
  cbs_code text,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### chart_of_accounts
```sql
CREATE TABLE public.chart_of_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code varchar NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL,   -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  english_description text,
  spanish_description text,
  parent_id uuid,               -- FK self-ref
  allow_posting boolean DEFAULT true,
  currency varchar,
  base_currency varchar,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### employees
```sql
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cedula text NOT NULL,
  position text DEFAULT 'General',
  salary numeric DEFAULT 0,
  date_of_hire date NOT NULL,
  date_of_termination date,
  is_active boolean DEFAULT true,
  sex text,
  date_of_birth date,
  bank text,
  bank_account_number text,
  shirt_size text,
  pant_size text,
  boot_size text,
  entity_id uuid NOT NULL DEFAULT current_user_entity_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2.4 Foreign Key Constraints

```sql
-- advance_allocations
ALTER TABLE advance_allocations ADD CONSTRAINT advance_allocations_advance_doc_id_fkey FOREIGN KEY (advance_doc_id) REFERENCES ap_ar_documents(id);
ALTER TABLE advance_allocations ADD CONSTRAINT advance_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES auth.users(id);
ALTER TABLE advance_allocations ADD CONSTRAINT advance_allocations_invoice_doc_id_fkey FOREIGN KEY (invoice_doc_id) REFERENCES ap_ar_documents(id);

-- ap_ar_document_transactions
ALTER TABLE ap_ar_document_transactions ADD CONSTRAINT ap_ar_document_transactions_document_id_fkey FOREIGN KEY (document_id) REFERENCES ap_ar_documents(id) ON DELETE CASCADE;
ALTER TABLE ap_ar_document_transactions ADD CONSTRAINT ap_ar_document_transactions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;

-- ap_ar_documents
ALTER TABLE ap_ar_documents ADD CONSTRAINT ap_ar_documents_account_id_fkey FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE ap_ar_documents ADD CONSTRAINT ap_ar_documents_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- ap_ar_payments
ALTER TABLE ap_ar_payments ADD CONSTRAINT ap_ar_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
ALTER TABLE ap_ar_payments ADD CONSTRAINT ap_ar_payments_document_id_fkey FOREIGN KEY (document_id) REFERENCES ap_ar_documents(id) ON DELETE CASCADE;
ALTER TABLE ap_ar_payments ADD CONSTRAINT ap_ar_payments_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES journals(id);

-- approval_policies
ALTER TABLE approval_policies ADD CONSTRAINT approval_policies_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- approval_requests
ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- bank_accounts
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_chart_account_id_fkey FOREIGN KEY (chart_account_id) REFERENCES chart_of_accounts(id);
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- bank_statement_lines
ALTER TABLE bank_statement_lines ADD CONSTRAINT bank_statement_lines_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE;
ALTER TABLE bank_statement_lines ADD CONSTRAINT bank_statement_lines_matched_journal_id_fkey FOREIGN KEY (matched_journal_id) REFERENCES journals(id);
ALTER TABLE bank_statement_lines ADD CONSTRAINT bank_statement_lines_matched_transaction_id_fkey FOREIGN KEY (matched_transaction_id) REFERENCES transactions(id);

-- budget_lines
ALTER TABLE budget_lines ADD CONSTRAINT budget_lines_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);
ALTER TABLE budget_lines ADD CONSTRAINT budget_lines_parent_line_id_fkey FOREIGN KEY (parent_line_id) REFERENCES budget_lines(id) ON DELETE CASCADE;

-- chart_of_accounts
ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id);

-- contact_bank_accounts
ALTER TABLE contact_bank_accounts ADD CONSTRAINT contact_bank_accounts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- contacts
ALTER TABLE contacts ADD CONSTRAINT contacts_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- cronograma_entries
ALTER TABLE cronograma_entries ADD CONSTRAINT cronograma_entries_cronograma_week_id_fkey FOREIGN KEY (cronograma_week_id) REFERENCES cronograma_weeks(id);
ALTER TABLE cronograma_entries ADD CONSTRAINT cronograma_entries_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);
ALTER TABLE cronograma_entries ADD CONSTRAINT cronograma_entries_source_operation_id_fkey FOREIGN KEY (source_operation_id) REFERENCES operations(id);

-- cronograma_weeks
ALTER TABLE cronograma_weeks ADD CONSTRAINT cronograma_weeks_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- day_labor_entries
ALTER TABLE day_labor_entries ADD CONSTRAINT day_labor_entries_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES entities(id);

-- depreciation_schedule
ALTER TABLE depreciation_schedule ADD CONSTRAINT depreciation_schedule_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES fixed_assets(id) ON DELETE CASCADE;
ALTER TABLE depreciation_schedule ADD CONSTRAINT depreciation_schedule_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES journals(id);

-- employee_* tables all reference employees(id) and entities(id)
-- fixed_assets reference entities(id)
-- fuel_equipment references entities(id)
-- fuel_tanks references entities(id)
-- fuel_transactions references fuel_tanks(id), fuel_equipment(id), entities(id)
-- inventory_items references entities(id)
-- inventory_purchases references inventory_items(id), entities(id)
-- journal_lines references journals(id), chart_of_accounts(id), tax_codes(id)
-- journals references transactions(id), journals(id) [reversal], accounting_periods(id), entities(id)
-- operations references fields(id), fuel_equipment(id) [tractor_id], operation_types(id), entities(id)
-- operation_inputs references operations(id), inventory_items(id)
-- payroll_periods references entities(id)
-- payroll_snapshots references payroll_periods(id), employees(id)
-- service_entries references service_providers(id), entities(id)
-- service_entry_payments references service_entries(id), bank_accounts(id)
-- user_roles: user_id references auth.users(id), entity_id references entities(id), entity_group_id references entity_groups(id)
```

**MIGRATION NOTE:** All `REFERENCES auth.users(id)` constraints must be changed to reference a local `users` table that you create to hold user records (id, email, encrypted_password, etc.).

### 2.5 Views (10 total)

```sql
-- employees_safe: masks cedula and bank_account_number for non-admin/management
CREATE OR REPLACE VIEW public.employees_safe WITH (security_invoker = on) AS
SELECT id, name, "position", date_of_hire, date_of_termination, salary,
  is_active, shirt_size, pant_size, boot_size, date_of_birth, entity_id, sex,
  created_at, updated_at,
  CASE WHEN (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'management'))
    THEN cedula ELSE ('***-*******-' || right(cedula, 1)) END AS cedula,
  CASE WHEN (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'management'))
    THEN bank ELSE bank END AS bank,
  CASE WHEN (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'management'))
    THEN bank_account_number ELSE ('****' || right(COALESCE(bank_account_number, ''), 4)) END AS bank_account_number
FROM employees;

-- general_ledger: WITH (security_invoker = on)
CREATE OR REPLACE VIEW public.general_ledger WITH (security_invoker = on) AS
SELECT j.journal_date, j.journal_number, a.account_code, a.account_name, j.description,
  l.debit, l.credit,
  (l.debit * j.exchange_rate) AS debit_base,
  (l.credit * j.exchange_rate) AS credit_base,
  sum(((l.debit - l.credit) * j.exchange_rate)) OVER (
    PARTITION BY a.account_code ORDER BY j.journal_date, j.journal_number, l.id
  ) AS running_balance_base
FROM journal_lines l
JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
WHERE l.deleted_at IS NULL
ORDER BY a.account_code, j.journal_date, j.journal_number;

-- trial_balance_all
CREATE OR REPLACE VIEW public.trial_balance_all AS
SELECT a.account_code, a.account_name, a.account_type,
  sum(l.debit * j.exchange_rate) AS total_debit_base,
  sum(l.credit * j.exchange_rate) AS total_credit_base,
  sum((l.debit - l.credit) * j.exchange_rate) AS balance_base
FROM journal_lines l
JOIN chart_of_accounts a ON a.id = l.account_id
JOIN journals j ON j.id = l.journal_id AND j.posted = true
WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
GROUP BY a.account_code, a.account_name, a.account_type
ORDER BY a.account_code;

-- v_ap_ar_aging
CREATE OR REPLACE VIEW public.v_ap_ar_aging AS
SELECT d.id, d.entity_id, e.name AS entity_name, d.direction, d.document_number,
  d.document_date, d.due_date, d.total_amount, d.currency, d.total_amount_dop, d.status,
  (CURRENT_DATE - d.due_date) AS days_overdue,
  CASE WHEN d.due_date >= CURRENT_DATE THEN 'Current'
    WHEN (CURRENT_DATE - d.due_date) <= 30 THEN '1-30 days'
    WHEN (CURRENT_DATE - d.due_date) <= 60 THEN '31-60 days'
    WHEN (CURRENT_DATE - d.due_date) <= 90 THEN '61-90 days'
    ELSE '90+ days' END AS aging_bucket
FROM ap_ar_documents d LEFT JOIN entities e ON e.id = d.entity_id
WHERE d.status = ANY(ARRAY['open', 'partial']);

-- v_fuel_consumption
CREATE OR REPLACE VIEW public.v_fuel_consumption AS
SELECT fe.entity_id, ent.name AS entity_name,
  (date_trunc('month', ft.transaction_date))::date AS month,
  fe.name AS equipment_name, fe.equipment_type,
  sum(ft.gallons) AS gallons_dispensed, count(*) AS dispense_count,
  avg(ft.gallons_per_hour) AS avg_gallons_per_hour
FROM fuel_transactions ft
JOIN fuel_equipment fe ON fe.id = ft.equipment_id
LEFT JOIN entities ent ON ent.id = fe.entity_id
WHERE ft.transaction_type = 'dispense' AND ft.equipment_id IS NOT NULL
GROUP BY fe.entity_id, ent.name, date_trunc('month', ft.transaction_date), fe.name, fe.equipment_type
ORDER BY (date_trunc('month', ft.transaction_date))::date DESC, fe.name;

-- v_inventory_low_stock
CREATE OR REPLACE VIEW public.v_inventory_low_stock AS
SELECT ii.entity_id, e.name AS entity_name, ii.id, ii.commercial_name,
  ii.function, ii.current_quantity, ii.minimum_stock, ii.use_unit,
  (ii.minimum_stock - ii.current_quantity) AS shortage
FROM inventory_items ii LEFT JOIN entities e ON e.id = ii.entity_id
WHERE ii.is_active = true AND ii.minimum_stock IS NOT NULL AND ii.current_quantity <= ii.minimum_stock
ORDER BY (ii.minimum_stock - ii.current_quantity) DESC;

-- v_payroll_summary: WITH (security_invoker = on)
CREATE OR REPLACE VIEW public.v_payroll_summary WITH (security_invoker = on) AS
SELECT pp.entity_id, e.name AS entity_name, pp.id AS period_id,
  pp.start_date, pp.end_date, pp.status,
  count(ps.employee_id) AS employee_count,
  sum(ps.gross_pay) AS total_gross, sum(ps.tss) AS total_tss,
  sum(ps.isr) AS total_isr, sum(ps.total_benefits) AS total_benefits,
  sum(ps.net_pay) AS total_net
FROM payroll_periods pp
LEFT JOIN payroll_snapshots ps ON ps.period_id = pp.id
LEFT JOIN entities e ON e.id = pp.entity_id
GROUP BY pp.entity_id, e.name, pp.id, pp.start_date, pp.end_date, pp.status
ORDER BY pp.start_date DESC;

-- v_transactions_by_cost_center
CREATE OR REPLACE VIEW public.v_transactions_by_cost_center AS
SELECT t.entity_id, e.name AS entity_name,
  (date_trunc('month', t.transaction_date))::date AS month,
  t.cost_center, t.currency,
  sum(t.amount) AS total_amount, count(*) AS transaction_count
FROM transactions t LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false
GROUP BY t.entity_id, e.name, date_trunc('month', t.transaction_date), t.cost_center, t.currency
ORDER BY (date_trunc('month', t.transaction_date))::date DESC, t.cost_center;

-- v_transactions_with_dop
CREATE OR REPLACE VIEW public.v_transactions_with_dop AS
SELECT t.*, e.name AS entity_name,
  CASE WHEN t.currency = 'DOP' THEN t.amount
    ELSE COALESCE(t.amount_base_currency, t.amount) END AS amount_dop
FROM transactions t LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false;

-- v_trial_balance
CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT j.entity_id, e.name AS entity_name,
  ca.account_code, ca.account_name, ca.account_type,
  COALESCE(sum(jl.debit), 0) AS total_debits,
  COALESCE(sum(jl.credit), 0) AS total_credits,
  (COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)) AS balance
FROM chart_of_accounts ca
LEFT JOIN journal_lines jl ON jl.account_id = ca.id
LEFT JOIN journals j ON j.id = jl.journal_id AND j.posted = true
LEFT JOIN entities e ON e.id = j.entity_id
WHERE ca.allow_posting = true AND ca.deleted_at IS NULL
GROUP BY j.entity_id, e.name, ca.id, ca.account_code, ca.account_name, ca.account_type
ORDER BY ca.account_code;
```

### 2.6 Database Functions (60+)

All functions are defined with `SET search_path TO 'public'`. Most use `SECURITY DEFINER`.

**Complete function list:** `account_balances_from_journals` (2 overloads), `adjust_tank_level_on_fuel_tx`, `approve_request`, `audit_trigger_func`, `auto_reverse_on_void`, `auto_set_dgii_tipo_bienes`, `begin_stock_count`, `calculate_annual_isr`, `calculate_payroll_for_period` (2 overloads), `calculate_prestaciones`, `cancel_stock_count`, `check_ap_ar_payment_limit`, `check_period_overlap`, `check_transaction_approval`, `close_day_labor_week`, `count_unlinked_transactions`, `create_journal_from_transaction` (2 overloads), `create_reversal_journal`, `create_transaction_with_ap_ar`, `current_user_entity_id`, `default_exchange_rate`, `dgii_507_report`, `dgii_509_report`, `dgii_fmt_amount`, `dgii_id_type`, `dgii_pay_method`, `enforce_period_status_transition`, `enforce_single_current_payroll_period`, `foreign_currency_balances`, `generate_asset_code`, `generate_closing_journal` (2 overloads), `generate_dgii_606`, `generate_dgii_607`, `generate_dgii_608`, `generate_due_recurring_journals`, `generate_journal_number`, `generate_tss_autodeterminacion`, `get_all_public_tables`, `get_balance_sheet`, `get_cost_per_field`, `get_exchange_rate`, `get_fields_with_boundaries`, `get_hours_until_maintenance`, `get_pending_approvals`, `get_profit_loss`, `get_user_role`, `has_role`, `has_role_for_entity`, `income_statement`, `income_statement_detail`, `is_accountant_only`, `is_global_admin`, `is_mfa_verified`, `log_hr_changes`, `log_transaction_changes`, `post_journal`, `prevent_edit_posted_journal`, `prevent_edit_posted_journal_line`, `prevent_posting_closed_period`, `prevent_timesheet_in_locked_period`, `prevent_transaction_in_locked_period`, `reconcile_stock_count`, `register_service_partial_payment`, `reject_request`, `revalue_open_ap_ar` (2 overloads), `sync_advance_allocation_balances`, `sync_fuel_tanks_to_inventory`, `sync_period_status_to_is_closed`, `sync_service_entry_totals`, `trial_balance`, `tss_ascii`, `tss_fmt_amount`, `update_accounting_timestamp`, `update_document_balance`, `update_tank_last_pump_reading`, `update_tractor_hour_meter`, `update_updated_at_column`, `upsert_field_boundary`, `user_entity_ids`, `user_has_entity_access`, `user_has_group_access`, `validate_advance_allocation`, `validate_itbis_cap`, `validate_journal_balance`, `validate_operation_hour_gap`, `validate_postable_account`, `validate_user_role_scope`, `void_ap_ar_on_transaction_void`

**CRITICAL MIGRATION NOTES for functions:**

1. All functions that call `auth.uid()` must be replaced. In the self-hosted version, implement a `public.auth_uid()` function that reads the current user ID from a session variable (e.g., `current_setting('app.current_user_id', true)::uuid`).

2. All functions that call `auth.jwt()` (only `is_mfa_verified`) must be adapted similarly.

3. The `current_user_entity_id()` function is used as a DEFAULT on `entity_id` columns. It calls `auth.uid()` internally and must be replaced.

4. Functions using PostGIS (`get_fields_with_boundaries`, `upsert_field_boundary`) require the `postgis` extension on the target DB.

**To extract all function source code from the live database:**
```sql
SELECT proname, pg_get_functiondef(p.oid) AS funcdef
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' ORDER BY proname;
```

### 2.7 Triggers

| Trigger | Table | Timing | Event | Function |
|---------|-------|--------|-------|----------|
| `audit_accounting_periods` | `accounting_periods` | AFTER | INSERT | `audit_trigger_func` |
| `trg_check_period_overlap` | `accounting_periods` | BEFORE | INSERT | `check_period_overlap` |
| `trg_enforce_period_status` | `accounting_periods` | BEFORE | UPDATE | `enforce_period_status_transition` |
| `trg_sync_period_status` | `accounting_periods` | BEFORE | INSERT | `sync_period_status_to_is_closed` |
| `trg_update_periods` | `accounting_periods` | BEFORE | UPDATE | `update_accounting_timestamp` |
| `trg_sync_advance_allocation_balances` | `advance_allocations` | AFTER | INSERT | `sync_advance_allocation_balances` |
| `trg_validate_advance_allocation` | `advance_allocations` | BEFORE | INSERT | `validate_advance_allocation` |
| `update_alert_configurations_updated_at` | `alert_configurations` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_ap_ar_updated_at` | `ap_ar_documents` | BEFORE | UPDATE | `update_updated_at_column` |
| `trg_check_payment_limit` | `ap_ar_payments` | BEFORE | INSERT | `check_ap_ar_payment_limit` |
| `trg_update_document_balance` | `ap_ar_payments` | AFTER | INSERT | `update_document_balance` |
| `audit_bank_accounts` | `bank_accounts` | AFTER | INSERT | `audit_trigger_func` |
| `audit_bank_statement_lines` | `bank_statement_lines` | AFTER | INSERT | `audit_trigger_func` |
| `update_budget_lines_updated_at` | `budget_lines` | BEFORE | UPDATE | `update_updated_at_column` |
| `audit_chart_of_accounts` | `chart_of_accounts` | AFTER | INSERT | `audit_trigger_func` |
| `trg_update_coa` | `chart_of_accounts` | BEFORE | UPDATE | `update_accounting_timestamp` |
| `update_contacts_updated_at` | `contacts` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_cronograma_entries_updated_at` | `cronograma_entries` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_cronograma_weeks_updated_at` | `cronograma_weeks` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_day_labor_attachments_updated_at` | `day_labor_attachments` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_day_labor_entries_updated_at` | `day_labor_entries` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_employee_benefits_updated_at` | `employee_benefits` | BEFORE | UPDATE | `update_updated_at_column` |
| `trg_hr_audit_loans` | `employee_loans` | AFTER | INSERT | `log_hr_changes` |
| `update_employee_loans_updated_at` | `employee_loans` | BEFORE | UPDATE | `update_updated_at_column` |
| `trg_hr_audit_salary_history` | `employee_salary_history` | AFTER | INSERT | `log_hr_changes` |
| `trg_hr_audit_timesheets` | `employee_timesheets` | AFTER | UPDATE | `log_hr_changes` |
| `trg_lock_timesheets_by_period` | `employee_timesheets` | BEFORE | INSERT | `prevent_timesheet_in_locked_period` |
| `update_employee_timesheets_updated_at` | `employee_timesheets` | BEFORE | UPDATE | `update_updated_at_column` |
| `trg_hr_audit_employees` | `employees` | AFTER | UPDATE | `log_hr_changes` |
| `update_employees_updated_at` | `employees` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_entity_groups_updated_at` | `entity_groups` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_farms_updated_at` | `farms` | BEFORE | UPDATE | `update_updated_at_column` |
| `update_fields_updated_at` | `fields` | BEFORE | UPDATE | `update_updated_at_column` |
| `audit_fixed_assets` | `fixed_assets` | AFTER | INSERT | `audit_trigger_func` |
| `trg_generate_asset_code` | `fixed_assets` | BEFORE | INSERT | `generate_asset_code` |
| various `update_*_updated_at` | multiple tables | BEFORE | UPDATE | `update_updated_at_column` |
| `trg_adjust_tank_level` | `fuel_transactions` | AFTER | INSERT | `adjust_tank_level_on_fuel_tx` |
| `trg_sync_fuel_to_inventory` | `fuel_tanks` | AFTER | UPDATE | `sync_fuel_tanks_to_inventory` |
| `trg_auto_set_dgii_tipo` | `transactions` | BEFORE | INSERT | `auto_set_dgii_tipo_bienes` |
| `trg_auto_reverse_on_void` | `transactions` | AFTER | UPDATE | `auto_reverse_on_void` |
| `trg_check_transaction_approval` | `transactions` | BEFORE | INSERT | `check_transaction_approval` |
| `trg_default_exchange_rate` | `transactions` | BEFORE | INSERT | `default_exchange_rate` |
| `trg_lock_transactions_by_period` | `transactions` | BEFORE | INSERT/UPDATE/DELETE | `prevent_transaction_in_locked_period` |
| `trg_log_transaction_changes` | `transactions` | AFTER | UPDATE | `log_transaction_changes` |
| `trg_validate_itbis_cap` | `transactions` | BEFORE | INSERT/UPDATE | `validate_itbis_cap` |
| `trg_prevent_edit_posted_journal` | `journals` | BEFORE | UPDATE/DELETE | `prevent_edit_posted_journal` |
| `trg_prevent_posting_closed_period` | `journals` | BEFORE | INSERT/UPDATE | `prevent_posting_closed_period` |
| `trg_validate_journal_balance` | `journals` | BEFORE | UPDATE | `validate_journal_balance` |
| `trg_generate_journal_number` | `journals` | BEFORE | INSERT | `generate_journal_number` |
| `trg_prevent_edit_posted_line` | `journal_lines` | BEFORE | UPDATE/DELETE | `prevent_edit_posted_journal_line` |
| `trg_validate_postable_account` | `journal_lines` | BEFORE | INSERT/UPDATE | `validate_postable_account` |
| `trg_validate_operation_hour_gap` | `operations` | BEFORE | INSERT/UPDATE | `validate_operation_hour_gap` |
| `trg_update_tractor_hour_meter` | `operations` | AFTER | INSERT/UPDATE/DELETE | `update_tractor_hour_meter` |
| `trg_enforce_single_current` | `payroll_periods` | BEFORE | INSERT/UPDATE | `enforce_single_current_payroll_period` |
| `trg_sync_service_entry_totals` | `service_entry_payments` | AFTER | INSERT/UPDATE/DELETE | `sync_service_entry_totals` |
| `trg_validate_user_role_scope` | `user_roles` | BEFORE | INSERT/UPDATE | `validate_user_role_scope` |

### 2.8 Sequences

```sql
-- Used by journal_number generation
CREATE SEQUENCE IF NOT EXISTS journals_journal_number_seq;
CREATE SEQUENCE IF NOT EXISTS journal_seq_pj;
CREATE SEQUENCE IF NOT EXISTS journal_seq_sj;
CREATE SEQUENCE IF NOT EXISTS journal_seq_prj;
CREATE SEQUENCE IF NOT EXISTS journal_seq_cdj;
CREATE SEQUENCE IF NOT EXISTS journal_seq_crj;
CREATE SEQUENCE IF NOT EXISTS journal_seq_dep;
CREATE SEQUENCE IF NOT EXISTS journal_seq_adj;
-- Used by fixed asset code generation
CREATE SEQUENCE IF NOT EXISTS fixed_assets_code_seq;
```

### 2.9 Required Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;            -- ST_GeomFromGeoJSON, ST_Area, etc.
CREATE EXTENSION IF NOT EXISTS pgcrypto;           -- password hashing
```

### 2.10 RLS Policies Summary

All 93 tables have RLS enabled. The policy architecture uses these core helper functions:

- `has_role(user_id, role)` — checks if user has a specific role (any entity scope)
- `has_role_for_entity(user_id, role, entity_id)` — checks role scoped to entity (or global)
- `user_has_entity_access(entity_id)` — checks if user can see data for that entity
- `is_global_admin()` — checks if user has admin/management with NULL entity_id

**To extract all RLS policies:**
```sql
SELECT pol.polname, tab.relname, 
  CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class tab ON pol.polrelid = tab.oid
JOIN pg_namespace ns ON tab.relnamespace = ns.oid
WHERE ns.nspname = 'public'
ORDER BY tab.relname, pol.polname;
```

**MIGRATION NOTE:** In a self-hosted environment, RLS policies that call `auth.uid()` must be adapted to use a custom `auth_uid()` function that reads from a session variable. See Section 4 for the recommended implementation.

---

## 3. Environment Variables & Secrets

### 3.1 Frontend Environment Variables

| Variable | Value Pattern | Used In |
|----------|---------------|---------|
| `VITE_SUPABASE_URL` | `https://[ref].supabase.co` | Client init, edge function calls |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | JWT anon key | Client init, edge function calls |
| `VITE_SUPABASE_PROJECT_ID` | `hirrjrgakqlkmrrxabnv` | Alert/edge function URL construction |

**Replace with:**
| Variable | New Value |
|----------|-----------|
| `VITE_API_URL` | `https://your-droplet.example.com/api` |
| `VITE_STORAGE_URL` | `https://your-spaces-cdn.example.com` |

### 3.2 Backend Secrets

| Secret Name | Purpose | Used By Edge Functions |
|-------------|---------|----------------------|
| `DALLAS_AGRO_API_KEY` | Dallas Agro external API | `api-proxy` |
| `GPSGATE_API_KEY` | GPSGate GPS tracking API | `gpsgate-proxy` |
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini/GPT) | `ai-search`, `analyze-meter-image`, `generate-hr-letter` |
| `NANONETS_API_KEY` | Nanonets OCR API | `ocr-cedula`, `ocr-receipt` |
| `NANONETS_MODEL_ID` | Nanonets model identifier | `ocr-cedula`, `ocr-receipt` |
| `TELEGRAM_API_KEY` | Telegram Bot API token | `send-telegram` |

**MIGRATION NOTE:** The `LOVABLE_API_KEY` is specific to the Lovable AI Gateway. For self-hosting, you must replace this with direct API keys for the chosen AI provider (e.g., `GOOGLE_API_KEY` for Gemini, `OPENAI_API_KEY` for GPT).

---

## 4. Authentication Architecture

### 4.1 Current Flow (Supabase GoTrue)

1. User submits email + password → `supabase.auth.signInWithPassword()`
2. Supabase returns JWT session
3. Frontend calls `supabase.rpc('get_user_role', { _user_id: userId })` to fetch role
4. Role stored in React context (`AuthContext.tsx`)
5. JWT sent automatically with all PostgREST/storage/function calls
6. RLS policies extract `auth.uid()` from JWT

### 4.2 Role System

6 roles stored in `user_roles` table:
- **admin** — Full access, global scope allowed
- **management** — Full access except settings, global scope allowed
- **accountant** — Financial + HR, entity-scoped required
- **supervisor** — Operations/field, entity-scoped required
- **viewer** — Read-only, entity-scoped required
- **driver** — Driver portal only, entity-scoped required

### 4.3 Self-Hosted Replacement

**Recommended stack:**
- **Node.js (Express/Fastify)** REST API on Ubuntu Droplet
- **bcrypt** for password hashing
- **jsonwebtoken** for JWT generation/verification
- **PostgreSQL session variables** for RLS compatibility

**Implementation steps:**

1. Create a `users` table:
```sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

2. Create `auth_uid()` replacement:
```sql
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT current_setting('app.current_user_id', true)::uuid; $$;
```

3. In your Node.js API middleware, after JWT verification:
```sql
SET LOCAL app.current_user_id = '<user-uuid>';
```

4. Search-and-replace all occurrences of `auth.uid()` in functions/policies with `public.auth_uid()`.

5. Implement these API endpoints:
   - `POST /api/auth/login` — bcrypt verify, return JWT
   - `POST /api/auth/logout` — client-side token removal
   - `POST /api/auth/reset-password` — email-based flow
   - `PUT /api/auth/update-password` — authenticated password change

### 4.4 Permission System (Frontend)

File: `src/lib/permissions.ts`

This file defines:
- `routeToSection` — maps 22 routes to section names
- `sectionPermissions` — which roles can access each section
- `writePermissions` — which roles can write to each section
- `hrTabPermissions` — granular HR sub-tab access
- `getDefaultRouteForRole()` — login redirect logic

**This file requires NO changes for migration** — it's pure frontend logic.

### 4.5 Frontend Auth Files to Modify

| File | Change Required |
|------|-----------------|
| `src/integrations/supabase/client.ts` | Replace with custom API client |
| `src/contexts/AuthContext.tsx` | Replace Supabase auth calls with fetch to Node.js API |
| `src/pages/Login.tsx` | Update `resetPasswordForEmail` call |
| `src/pages/ResetPassword.tsx` | Update `getSession` and `updateUser` calls |
| `src/components/settings/MfaSettings.tsx` | Replace MFA calls (or remove if not implementing) |
| `src/components/auth/ProtectedRoute.tsx` | No changes needed (uses AuthContext) |

---

## 5. File Storage Usage

### 5.1 Current Buckets

| Bucket | Public | Size Limit | MIME Filter |
|--------|--------|------------|-------------|
| `transaction-attachments` | private | none | none |
| `employee-documents` | private | none | none |

### 5.2 Storage Policies

```sql
-- transaction-attachments
-- SELECT: admin, management, accountant, supervisor
-- INSERT: accountant, admin, management
-- UPDATE: DENIED (false)
-- DELETE: admin only

-- employee-documents
-- SELECT: admin, management, accountant, supervisor
-- INSERT: admin, management only
-- UPDATE: DENIED (false)
-- DELETE: admin only
```

### 5.3 File Naming Convention

Transaction attachments: `receipts/{category}_{timestamp}_{transactionId}.{ext}`
Employee documents: `{employeeId}/{timestamp}_{filename}`

### 5.4 Signed URL Flow

1. File path stored in DB (e.g., `receipts/payment_receipt_1234567890_TX-456.jpg`)
2. Frontend calls edge function `get-signed-url` with `{ filePath }`
3. Edge function uses service role client to generate 1-hour signed URL
4. Signed URL returned to frontend for display

### 5.5 DO Spaces Migration

1. Create two DO Spaces buckets: `transaction-attachments`, `employee-documents`
2. Set both to private
3. Implement signed URL generation in your Node.js API using `@aws-sdk/s3-request-presigner`
4. Replace `supabase.storage.from(bucket).upload(...)` calls with S3-compatible uploads
5. Migrate existing files from Supabase Storage using the Supabase Management API or `supabase storage ls` + `supabase storage cp`

**Files to modify:**
- `src/lib/storage.ts` — main upload/signed-url logic
- `src/components/transactions/AttachmentCell.tsx`
- `src/components/transactions/AttachmentUpload.tsx`
- `src/components/transactions/MultiAttachmentCell.tsx`
- `src/components/transactions/MultiAttachmentUpload.tsx`
- `src/components/hr/EmployeeDetailDialog.tsx`
- `src/components/hr/DayLaborAttachment.tsx`
- `src/components/settings/backup/backupUtils.ts`

---

## 6. Realtime & WebSocket Usage

**Status: NOT USED**

Confirmed: zero calls to `supabase.channel()` or `supabase.realtime` anywhere in the codebase. No `ALTER PUBLICATION supabase_realtime ADD TABLE` in migrations.

No Realtime migration is required.

---

## 7. Frontend Architecture

### 7.1 Tech Stack

- **React 18.3** with TypeScript 5.8
- **Vite 5.4** bundler
- **Tailwind CSS 3.4** with `tailwindcss-animate`
- **shadcn/ui** component library (Radix UI primitives)
- **React Router 6.30** for routing
- **TanStack React Query 5.83** for data fetching/caching
- **Recharts 2.15** for charts
- **Mapbox GL 3.18** for maps
- **ExcelJS 4.4** for Excel export
- **jsPDF 4.0 + jspdf-autotable 5.0** for PDF generation

### 7.2 Key Architecture Patterns

1. **API Layer** (`src/lib/api.ts`) — Centralized CRUD for transactions, wraps Supabase calls
2. **Entity Context** (`src/contexts/EntityContext.tsx`) — Multi-entity filtering
3. **Auth Context** (`src/contexts/AuthContext.tsx`) — Session + role management
4. **Language Context** (`src/contexts/LanguageContext.tsx`) — EN/ES i18n
5. **Sidebar Context** (`src/contexts/SidebarContext.tsx`) — UI state

### 7.3 Migration Approach for Frontend

**Option A (Recommended): Create a Supabase-compatible API wrapper**

Create a drop-in replacement for the Supabase client that translates `.from().select().eq()` chains into REST API calls to your Node.js backend. This minimizes frontend changes.

```typescript
// src/integrations/api/client.ts
// Implement PostgREST-compatible query builder that calls your Express API
```

**Option B: Direct replacement**

Replace all `supabase.from()` calls with `fetch()` or Axios calls. This requires modifying 141 files.

### 7.4 PostgREST Compatibility

If you want minimal frontend changes, run PostgREST directly on your Ubuntu Droplet pointing at your DO Managed PostgreSQL. This gives you the exact same REST API that Supabase provides, including:
- `.from().select().eq().order().limit()` query translation
- Embedded joins via FK relationships
- RPC function calls via `POST /rpc/function_name`

**This is the recommended approach** — it requires zero frontend PostgREST code changes.

---

## 8. Third-Party Integrations

### 8.1 Dallas Agro API
- **Edge function:** `api-proxy`
- **Secret:** `DALLAS_AGRO_API_KEY`
- **Usage:** External agricultural data proxy

### 8.2 GPSGate
- **Edge function:** `gpsgate-proxy`
- **Secret:** `GPSGATE_API_KEY`
- **Usage:** GPS tracking for tractors/equipment
- **Frontend files:** `src/components/settings/GPSLinkingManager.tsx`, `src/components/operations/LivePositionsControl.tsx`, `src/components/operations/TrackHistoryControls.tsx`

### 8.3 Nanonets OCR
- **Edge functions:** `ocr-cedula`, `ocr-receipt`
- **Secrets:** `NANONETS_API_KEY`, `NANONETS_MODEL_ID`
- **Usage:** Dominican ID card scanning, receipt scanning

### 8.4 Telegram
- **Edge function:** `send-telegram`
- **Secret:** `TELEGRAM_API_KEY`
- **Usage:** Notification bot for operations alerts
- **Frontend files:** `src/components/settings/TelegramSettings.tsx`, `src/components/operations/OperationsLogView.tsx`

### 8.5 Lovable AI Gateway
- **Edge functions:** `ai-search`, `analyze-meter-image`, `generate-hr-letter`
- **Secret:** `LOVABLE_API_KEY`
- **Models used:** Google Gemini, OpenAI GPT
- **Replacement:** Direct API calls to Google/OpenAI with your own API keys

### 8.6 Mapbox GL
- **No edge function** — client-side library
- **Token:** hardcoded in frontend (publishable)
- **No migration impact** if same token is used

---

## 9. Migration Risk Assessment

### Risk 1: auth.uid() Dependency (CRITICAL)
- **Impact:** Every RLS policy and 40+ functions call `auth.uid()`
- **Mitigation:** Implement `SET LOCAL app.current_user_id` pattern; create `auth_uid()` wrapper; global search-replace in all function/policy definitions
- **Verification:** Run `SELECT count(*) FROM pg_proc WHERE prosrc LIKE '%auth.uid()%'` — should return 0 after migration

### Risk 2: Data Export Completeness (HIGH)
- **Impact:** Missing rows due to RLS during export
- **Mitigation:** Use service role or superuser for `pg_dump`; verify row counts match
- **Verification:** Compare `SELECT tablename, n_live_tup FROM pg_stat_user_tables` before and after

### Risk 3: Foreign Keys to auth.users (HIGH)
- **Impact:** ~15 FKs reference `auth.users(id)` which won't exist on DO
- **Mitigation:** Create local `users` table; migrate user data from `auth.users`; update FKs
- **Verification:** Run `\d+ user_roles` and verify FK points to `public.users`

### Risk 4: Edge Function Migration (MEDIUM)
- **Impact:** 19 Deno edge functions must become Node.js Express routes
- **Mitigation:** Convert one at a time; test each with curl before proceeding
- **Verification:** Hit each endpoint and verify response matches Supabase version

### Risk 5: Storage File Migration (MEDIUM)
- **Impact:** All attachments must be copied to DO Spaces
- **Mitigation:** Script the migration using Supabase Storage API `list` + `download` → S3 `putObject`
- **Verification:** Count files in both buckets; spot-check 10 random files

---

## 10. Recommended Migration Sequence

### Layer 0: Infrastructure Setup
1. Provision DO Managed PostgreSQL cluster (PostgreSQL 15+)
2. Provision Ubuntu Droplet (4GB+ RAM)
3. Create two DO Spaces buckets (private)
4. Install Node.js 20+, PM2, Nginx on Droplet
5. Enable PostgreSQL extensions: `uuid-ossp`, `postgis`, `pgcrypto`

**Verification:** `psql -c "SELECT version();"` returns PostgreSQL 15+; `SELECT PostGIS_Version();` succeeds.

### Layer 1: Database Schema Migration
1. Export schema from Supabase: `pg_dump --schema-only --no-owner --no-acl -n public`
2. Create local `users` table (see Section 4)
3. Create `auth_uid()` function (see Section 4)
4. Search-replace `auth.uid()` → `public.auth_uid()` in all function/trigger/policy definitions
5. Search-replace `REFERENCES auth.users(id)` → `REFERENCES public.users(id)`
6. Run schema SQL against DO PostgreSQL
7. Create all sequences (Section 2.8)
8. Create all views (Section 2.5)

**Verification:**
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'; -- should be 94 (93 + users)
SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace; -- should match source
SELECT count(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND NOT t.tgisinternal; -- should match source
```

### Layer 2: Data Migration
1. Export data from Supabase using service role: `pg_dump --data-only --no-owner -n public`
2. Export `auth.users` table: 
```sql
SELECT id, email, encrypted_password, created_at, updated_at 
FROM auth.users;
```
3. Insert users into local `public.users` table
4. Import all public schema data
5. Reset sequences to max values

**Verification:**
```sql
-- Compare row counts for every table
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;
```

### Layer 3: Authentication API
1. Create Express/Fastify API on Droplet
2. Implement `/api/auth/login` with bcrypt + JWT
3. Implement middleware that sets `app.current_user_id` on each DB connection
4. Implement `/api/auth/reset-password`, `/api/auth/update-password`
5. Test: login returns valid JWT; DB queries respect RLS

**Verification:** `curl -X POST /api/auth/login -d '{"email":"...","password":"..."}' ` returns JWT; subsequent query with JWT returns correct entity-scoped data.

### Layer 4: PostgREST Setup (Recommended)
1. Install PostgREST on Droplet
2. Configure it to connect to DO PostgreSQL with a role that has RLS applied
3. Configure JWT verification to match your Node.js-issued JWTs
4. Proxy through Nginx: `/rest/v1/*` → PostgREST

**Verification:** `curl -H "Authorization: Bearer <jwt>" https://your-api.com/rest/v1/transactions?limit=5` returns data.

### Layer 5: Edge Functions → Express Routes
1. Convert each of the 19 edge functions to Express route handlers
2. Priority order: `get-signed-url` → `create-user` → `get-users` → `delete-user` → `update-user-role` → `reset-user-password` → `generate-journals` → `ai-search` → `send-telegram` → rest
3. Set up secrets as environment variables on the Droplet

**Verification:** For each endpoint, compare response from old Supabase function with new Express route using same input.

### Layer 6: File Storage Migration
1. Script to list all files in both Supabase buckets
2. Download each file and upload to DO Spaces
3. Update `src/lib/storage.ts` to use S3 SDK
4. Update all 8 files that reference `supabase.storage`

**Verification:** Count files in DO Spaces matches Supabase; open 10 random attachments via new signed URLs.

### Layer 7: Frontend Configuration
1. Update `.env` with new API URLs
2. Replace `src/integrations/supabase/client.ts` with new client (PostgREST-compatible or custom)
3. Update `src/contexts/AuthContext.tsx` to use new auth API
4. Update all edge function `invoke()` calls to use `fetch()` to new Express routes
5. Build and test

**Verification:** Full app test: login → navigate all 22 routes → create transaction → upload attachment → view reports → logout.

### Layer 8: DNS & SSL
1. Point domain to Droplet
2. Configure Nginx reverse proxy
3. Set up Let's Encrypt SSL
4. Configure CORS for frontend origin

**Verification:** `curl -I https://your-domain.com/api/health` returns 200 with valid SSL cert.

### Layer 9: Cutover
1. Put Supabase app in maintenance mode
2. Run final data sync (incremental pg_dump)
3. Run final file sync
4. Switch DNS
5. Verify production

**Verification:** Full production smoke test by 2+ users with different roles.

---

## Appendix A: File Modification Index

Files requiring modification during migration:

| Priority | File | Change |
|----------|------|--------|
| P0 | `src/integrations/supabase/client.ts` | Replace entirely |
| P0 | `src/contexts/AuthContext.tsx` | Replace auth calls |
| P0 | `src/lib/api.ts` | Update if not using PostgREST |
| P0 | `src/lib/storage.ts` | Replace with S3 SDK |
| P1 | `src/components/transactions/AttachmentCell.tsx` | Storage calls |
| P1 | `src/components/transactions/AttachmentUpload.tsx` | Storage calls |
| P1 | `src/components/transactions/MultiAttachmentCell.tsx` | Storage calls |
| P1 | `src/components/transactions/MultiAttachmentUpload.tsx` | Storage calls |
| P1 | `src/components/hr/EmployeeDetailDialog.tsx` | Storage calls |
| P1 | `src/components/hr/DayLaborAttachment.tsx` | Storage calls |
| P1 | `src/components/settings/backup/backupUtils.ts` | Storage calls |
| P1 | `src/lib/attachments.ts` | Signed URL calls |
| P2 | 15 files with `supabase.functions.invoke()` | Replace with fetch to Express |
| P2 | `src/pages/Login.tsx` | Reset password call |
| P2 | `src/pages/ResetPassword.tsx` | Auth calls |
| P2 | `src/components/settings/MfaSettings.tsx` | MFA calls |
| P3 | `.env` | New variables |

## Appendix B: Complete Column Schema Reference

The authoritative column-level schema is in `src/integrations/supabase/types.ts` (read-only, auto-generated). This file contains every table's Row, Insert, and Update types with exact column names, TypeScript types (mapping to PostgreSQL types), nullability, and optionality.

For the PostgreSQL-native schema, run:
```sql
SELECT c.relname AS table_name, a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  a.attnotnull AS not_null,
  pg_get_expr(d.adbin, d.adrelid) AS default_value
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;
```

## Appendix C: Index Reference

To extract all indexes:
```sql
SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
```

Notable non-PK indexes:
- `idx_audit_log_created`, `idx_audit_log_record`, `idx_audit_log_table`, `idx_audit_log_user` on `accounting_audit_log`
- `idx_ap_ar_docs_entity`, `idx_ap_ar_documents_direction`, `idx_ap_ar_documents_due_date`, `idx_ap_ar_documents_status` on `ap_ar_documents`
- `idx_approval_requests_entity`, `idx_approval_requests_record`, `idx_approval_requests_status` (partial: WHERE status = 'pending') on `approval_requests`
- `idx_transactions_entity`, `idx_transactions_date`, `idx_transactions_direction` on `transactions`
- `idx_journals_entity`, `idx_journals_date`, `idx_journals_source_tx` on `journals`
- `idx_journal_lines_account`, `idx_journal_lines_journal` on `journal_lines`
- Various unique constraints on composite keys

---

*End of migration document. This file is committed at `docs/migration.md` and will sync to GitHub automatically.*
