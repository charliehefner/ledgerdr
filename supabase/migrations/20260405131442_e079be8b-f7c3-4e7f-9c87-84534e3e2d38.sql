
-- ============================================================
-- PART 1: Recreate 10 views with security_invoker = on
-- ============================================================

-- 1. employees_safe
DROP VIEW IF EXISTS employees_safe;
CREATE VIEW employees_safe WITH (security_invoker = on) AS
SELECT id, name, position, date_of_hire, date_of_termination, salary, is_active,
  shirt_size, pant_size, boot_size, date_of_birth, created_at, updated_at,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
    THEN cedula ELSE ('***-*******-' || right(cedula, 1)) END AS cedula,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
    THEN bank ELSE bank END AS bank,
  CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
    THEN bank_account_number ELSE ('****' || right(COALESCE(bank_account_number, ''), 4)) END AS bank_account_number
FROM employees;

-- 2. general_ledger
DROP VIEW IF EXISTS general_ledger;
CREATE VIEW general_ledger WITH (security_invoker = on) AS
SELECT j.journal_date, j.journal_number, a.account_code, a.account_name, j.description,
  l.debit, l.credit,
  (l.debit * j.exchange_rate) AS debit_base,
  (l.credit * j.exchange_rate) AS credit_base,
  sum(((l.debit - l.credit) * j.exchange_rate)) OVER (PARTITION BY a.account_code ORDER BY j.journal_date, j.journal_number, l.id) AS running_balance_base
FROM journal_lines l
JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
WHERE l.deleted_at IS NULL
ORDER BY a.account_code, j.journal_date, j.journal_number;

-- 3. trial_balance_all
DROP VIEW IF EXISTS trial_balance_all;
CREATE VIEW trial_balance_all WITH (security_invoker = on) AS
SELECT a.account_code, a.account_name, a.account_type,
  sum((l.debit * j.exchange_rate)) AS total_debit_base,
  sum((l.credit * j.exchange_rate)) AS total_credit_base,
  sum(((l.debit - l.credit) * j.exchange_rate)) AS balance_base
FROM journal_lines l
JOIN chart_of_accounts a ON a.id = l.account_id
JOIN journals j ON j.id = l.journal_id AND j.posted = true
WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
GROUP BY a.account_code, a.account_name, a.account_type
ORDER BY a.account_code;

-- 4. v_ap_ar_aging
DROP VIEW IF EXISTS v_ap_ar_aging;
CREATE VIEW v_ap_ar_aging WITH (security_invoker = on) AS
SELECT d.id, d.entity_id, e.name AS entity_name, d.direction, d.document_number,
  d.document_date, d.due_date, d.total_amount, d.currency, d.total_amount_dop, d.status,
  (CURRENT_DATE - d.due_date) AS days_overdue,
  CASE
    WHEN d.due_date >= CURRENT_DATE THEN 'Current'
    WHEN (CURRENT_DATE - d.due_date) <= 30 THEN '1-30 days'
    WHEN (CURRENT_DATE - d.due_date) <= 60 THEN '31-60 days'
    WHEN (CURRENT_DATE - d.due_date) <= 90 THEN '61-90 days'
    ELSE '90+ days'
  END AS aging_bucket
FROM ap_ar_documents d
LEFT JOIN entities e ON e.id = d.entity_id
WHERE d.status = ANY (ARRAY['open', 'partial']);

-- 5. v_fuel_consumption
DROP VIEW IF EXISTS v_fuel_consumption;
CREATE VIEW v_fuel_consumption WITH (security_invoker = on) AS
SELECT fe.entity_id, ent.name AS entity_name,
  (date_trunc('month', ft.transaction_date))::date AS month,
  fe.name AS equipment_name, fe.equipment_type,
  sum(ft.gallons) AS gallons_dispensed,
  count(*) AS dispense_count,
  avg(ft.gallons_per_hour) AS avg_gallons_per_hour
FROM fuel_transactions ft
JOIN fuel_equipment fe ON fe.id = ft.equipment_id
LEFT JOIN entities ent ON ent.id = fe.entity_id
WHERE ft.transaction_type = 'dispense' AND ft.equipment_id IS NOT NULL
GROUP BY fe.entity_id, ent.name, date_trunc('month', ft.transaction_date), fe.name, fe.equipment_type
ORDER BY (date_trunc('month', ft.transaction_date))::date DESC, fe.name;

-- 6. v_inventory_low_stock
DROP VIEW IF EXISTS v_inventory_low_stock;
CREATE VIEW v_inventory_low_stock WITH (security_invoker = on) AS
SELECT ii.entity_id, e.name AS entity_name, ii.id, ii.commercial_name, ii.function,
  ii.current_quantity, ii.minimum_stock, ii.use_unit,
  (ii.minimum_stock - ii.current_quantity) AS shortage
FROM inventory_items ii
LEFT JOIN entities e ON e.id = ii.entity_id
WHERE ii.is_active = true AND ii.minimum_stock IS NOT NULL AND ii.current_quantity <= ii.minimum_stock
ORDER BY (ii.minimum_stock - ii.current_quantity) DESC;

-- 7. v_payroll_summary
DROP VIEW IF EXISTS v_payroll_summary;
CREATE VIEW v_payroll_summary WITH (security_invoker = on) AS
SELECT pp.entity_id, e.name AS entity_name, pp.id AS period_id,
  pp.start_date, pp.end_date, pp.status,
  count(ps.employee_id) AS employee_count,
  sum(ps.gross_pay) AS total_gross,
  sum(ps.tss) AS total_tss,
  sum(ps.isr) AS total_isr,
  sum(ps.total_benefits) AS total_benefits,
  sum(ps.net_pay) AS total_net
FROM payroll_periods pp
LEFT JOIN payroll_snapshots ps ON ps.period_id = pp.id
LEFT JOIN entities e ON e.id = pp.entity_id
GROUP BY pp.entity_id, e.name, pp.id, pp.start_date, pp.end_date, pp.status
ORDER BY pp.start_date DESC;

-- 8. v_transactions_by_cost_center
DROP VIEW IF EXISTS v_transactions_by_cost_center;
CREATE VIEW v_transactions_by_cost_center WITH (security_invoker = on) AS
SELECT t.entity_id, e.name AS entity_name,
  (date_trunc('month', t.transaction_date::timestamp with time zone))::date AS month,
  t.cost_center, t.currency,
  sum(t.amount) AS total_amount,
  count(*) AS transaction_count
FROM transactions t
LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false
GROUP BY t.entity_id, e.name, date_trunc('month', t.transaction_date::timestamp with time zone), t.cost_center, t.currency
ORDER BY (date_trunc('month', t.transaction_date::timestamp with time zone))::date DESC, t.cost_center;

-- 9. v_transactions_with_dop
DROP VIEW IF EXISTS v_transactions_with_dop;
CREATE VIEW v_transactions_with_dop WITH (security_invoker = on) AS
SELECT t.id, t.legacy_id, t.transaction_date, t.master_acct_code, t.project_code,
  t.cbs_code, t.description, t.currency, t.amount, t.itbis, t.pay_method,
  t.document, t.name, t.comments, t.is_void, t.void_reason, t.voided_at,
  t.created_at, t.updated_at, t.rnc, t.is_internal,
  t.dgii_tipo_bienes_servicios, t.itbis_retenido, t.isr_retenido,
  t.dgii_tipo_ingreso, t.dgii_tipo_anulacion, t.transaction_direction,
  t.cost_center, t.account_id, t.project_id, t.cbs_id,
  t.destination_acct_code, t.due_date, t.destination_amount,
  t.itbis_override_reason, t.exchange_rate, t.purchase_date,
  t.exchange_rate_used, t.amount_base_currency, t.entity_id,
  e.name AS entity_name,
  CASE WHEN t.currency = 'DOP' THEN t.amount ELSE COALESCE(t.amount_base_currency, t.amount) END AS amount_dop
FROM transactions t
LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false;

-- 10. v_trial_balance
DROP VIEW IF EXISTS v_trial_balance;
CREATE VIEW v_trial_balance WITH (security_invoker = on) AS
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

-- ============================================================
-- PART 2: Drop legacy has_role() policies on entity-scoped tables
-- ============================================================

DROP POLICY IF EXISTS "Admins, management, and supervisors can insert cronograma entri" ON cronograma_entries;
DROP POLICY IF EXISTS "Admins, management, and supervisors can insert cronograma weeks" ON cronograma_weeks;
DROP POLICY IF EXISTS "Accountants can insert day labor entries" ON day_labor_entries;
DROP POLICY IF EXISTS "Accountants can insert timesheets" ON employee_timesheets;
DROP POLICY IF EXISTS "Accountants can insert fuel equipment" ON fuel_equipment;
DROP POLICY IF EXISTS "Accountants can insert fuel tanks" ON fuel_tanks;
DROP POLICY IF EXISTS "Accountants can insert fuel transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Drivers can insert dispense transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Accountants can insert implements" ON implements;
DROP POLICY IF EXISTS "Admin and supervisor full access on carretas" ON industrial_carretas;
DROP POLICY IF EXISTS "Admin and supervisor full access on plant_hours" ON industrial_plant_hours;
DROP POLICY IF EXISTS "Admin and supervisor full access on trucks" ON industrial_trucks;
DROP POLICY IF EXISTS "Accountants can insert inventory items" ON inventory_items;
DROP POLICY IF EXISTS "Accountants can insert inventory purchases" ON inventory_purchases;
DROP POLICY IF EXISTS "Accountants can insert operation_inputs" ON operation_inputs;
DROP POLICY IF EXISTS "Accountants can insert operations" ON operations;
DROP POLICY IF EXISTS "entity_driver_insert_pending" ON pending_fuel_submissions;
DROP POLICY IF EXISTS "Accountants can insert period benefits" ON period_employee_benefits;
DROP POLICY IF EXISTS "Accountants can insert attachments" ON transaction_attachments;
DROP POLICY IF EXISTS "Accountants can insert transactions" ON transactions;

-- ============================================================
-- PART 3: Fix open policies on fixed_asset_depreciation_entries
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read depreciation entries" ON fixed_asset_depreciation_entries;
DROP POLICY IF EXISTS "Authenticated users can insert depreciation entries" ON fixed_asset_depreciation_entries;

CREATE POLICY "Management can view depreciation entries"
ON fixed_asset_depreciation_entries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Management can insert depreciation entries"
ON fixed_asset_depreciation_entries FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
);

-- ============================================================
-- PART 4: Fix tractor_operators — drop open duplicates
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read tractor_operators" ON tractor_operators;
DROP POLICY IF EXISTS "Authenticated users can insert tractor_operators" ON tractor_operators;
DROP POLICY IF EXISTS "Authenticated users can update tractor_operators" ON tractor_operators;
DROP POLICY IF EXISTS "Authenticated users can delete tractor_operators" ON tractor_operators;
-- Keep: tractor_operators_select (USING true for reads) and tractor_operators_write (role-restricted)

-- ============================================================
-- PART 5: Fix transportation_units — drop open duplicates
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read transportation_units" ON transportation_units;
DROP POLICY IF EXISTS "Authenticated users can insert transportation_units" ON transportation_units;
DROP POLICY IF EXISTS "Authenticated users can update transportation_units" ON transportation_units;
DROP POLICY IF EXISTS "Authenticated users can delete transportation_units" ON transportation_units;
-- Keep: transportation_units_select (USING true for reads) and transportation_units_write (role-restricted)

-- ============================================================
-- PART 6: Fix service_providers SELECT — restrict to authorized roles
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view service providers" ON service_providers;

CREATE POLICY "Authorized roles can view service providers"
ON service_providers FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- ============================================================
-- PART 7: Fix functions missing search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_ap_ar_payment_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF (
    SELECT COALESCE(SUM(amount), 0) + NEW.amount
    FROM ap_ar_payments
    WHERE document_id = NEW.document_id
  ) > (
    SELECT total_amount FROM ap_ar_documents WHERE id = NEW.document_id
  ) THEN
    RAISE EXCEPTION 'Payment would exceed document total amount';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_document_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_total numeric;
  v_paid numeric;
BEGIN
  SELECT total_amount INTO v_total FROM ap_ar_documents WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM ap_ar_payments WHERE document_id = COALESCE(NEW.document_id, OLD.document_id);

  UPDATE ap_ar_documents
  SET
    amount_paid = v_paid,
    balance_remaining = v_total - v_paid,
    status = CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'open'
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- PART 8: Storage bucket policy hardening
-- ============================================================

-- Drop overly permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view transaction attachments" ON storage.objects;

-- Restricted SELECT for employee documents
CREATE POLICY "Authorized roles can view employee documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'admin'::public.app_role)
    OR has_role(auth.uid(), 'management'::public.app_role)
    OR has_role(auth.uid(), 'accountant'::public.app_role)
    OR has_role(auth.uid(), 'supervisor'::public.app_role)
  )
);

-- Restricted SELECT for transaction attachments
CREATE POLICY "Authorized roles can view transaction attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (
    has_role(auth.uid(), 'admin'::public.app_role)
    OR has_role(auth.uid(), 'management'::public.app_role)
    OR has_role(auth.uid(), 'accountant'::public.app_role)
    OR has_role(auth.uid(), 'supervisor'::public.app_role)
  )
);

-- Explicit UPDATE deny on both buckets
CREATE POLICY "No updates on employee documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-documents' AND false);

CREATE POLICY "No updates on transaction attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'transaction-attachments' AND false);
