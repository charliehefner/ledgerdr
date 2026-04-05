
-- BUG 1: Enable RLS on ap_ar_document_transactions
ALTER TABLE public.ap_ar_document_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_select_ap_ar_doc_txn" ON public.ap_ar_document_transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d 
    WHERE d.id = document_id 
      AND (public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'viewer'::app_role, d.entity_id))
  ));

CREATE POLICY "entity_insert_ap_ar_doc_txn" ON public.ap_ar_document_transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d 
    WHERE d.id = document_id 
      AND (public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id))
  ));

CREATE POLICY "entity_delete_ap_ar_doc_txn" ON public.ap_ar_document_transactions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d 
    WHERE d.id = document_id 
      AND (public.has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
        OR public.has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id))
  ));

-- BUG 2: Recreate 9 views with security_invoker = on
CREATE OR REPLACE VIEW public.general_ledger
WITH (security_invoker = on) AS
SELECT j.journal_date, j.journal_number, a.account_code, a.account_name, j.description,
    l.debit, l.credit, (l.debit * j.exchange_rate) AS debit_base, (l.credit * j.exchange_rate) AS credit_base,
    sum(((l.debit - l.credit) * j.exchange_rate)) OVER (PARTITION BY a.account_code ORDER BY j.journal_date, j.journal_number, l.id) AS running_balance_base
FROM ((journal_lines l
  JOIN journals j ON (j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL))
  JOIN chart_of_accounts a ON (a.id = l.account_id AND a.deleted_at IS NULL))
WHERE l.deleted_at IS NULL
ORDER BY a.account_code, j.journal_date, j.journal_number;

CREATE OR REPLACE VIEW public.trial_balance_all
WITH (security_invoker = on) AS
SELECT a.account_code, a.account_name, a.account_type,
    sum(l.debit * j.exchange_rate) AS total_debit_base,
    sum(l.credit * j.exchange_rate) AS total_credit_base,
    sum((l.debit - l.credit) * j.exchange_rate) AS balance_base
FROM ((journal_lines l
  JOIN chart_of_accounts a ON (a.id = l.account_id))
  JOIN journals j ON (j.id = l.journal_id AND j.posted = true))
WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
GROUP BY a.account_code, a.account_name, a.account_type
ORDER BY a.account_code;

CREATE OR REPLACE VIEW public.v_ap_ar_aging
WITH (security_invoker = on) AS
SELECT d.id, d.entity_id, e.name AS entity_name, d.direction, d.document_number, d.document_date, d.due_date,
    d.total_amount, d.currency, d.total_amount_dop, d.status,
    (CURRENT_DATE - d.due_date) AS days_overdue,
    CASE WHEN d.due_date >= CURRENT_DATE THEN 'Current'
         WHEN (CURRENT_DATE - d.due_date) <= 30 THEN '1-30 days'
         WHEN (CURRENT_DATE - d.due_date) <= 60 THEN '31-60 days'
         WHEN (CURRENT_DATE - d.due_date) <= 90 THEN '61-90 days'
         ELSE '90+ days' END AS aging_bucket
FROM ap_ar_documents d LEFT JOIN entities e ON e.id = d.entity_id
WHERE d.status = ANY (ARRAY['open','partial']);

CREATE OR REPLACE VIEW public.v_fuel_consumption
WITH (security_invoker = on) AS
SELECT fe.entity_id, ent.name AS entity_name,
    (date_trunc('month', ft.transaction_date))::date AS month,
    fe.name AS equipment_name, fe.equipment_type,
    sum(ft.gallons) AS gallons_dispensed, count(*) AS dispense_count,
    avg(ft.gallons_per_hour) AS avg_gallons_per_hour
FROM (fuel_transactions ft JOIN fuel_equipment fe ON fe.id = ft.equipment_id)
  LEFT JOIN entities ent ON ent.id = fe.entity_id
WHERE ft.transaction_type = 'dispense' AND ft.equipment_id IS NOT NULL
GROUP BY fe.entity_id, ent.name, date_trunc('month', ft.transaction_date), fe.name, fe.equipment_type
ORDER BY (date_trunc('month', ft.transaction_date))::date DESC, fe.name;

CREATE OR REPLACE VIEW public.v_inventory_low_stock
WITH (security_invoker = on) AS
SELECT ii.entity_id, e.name AS entity_name, ii.id, ii.commercial_name, ii.function,
    ii.current_quantity, ii.minimum_stock, ii.use_unit,
    (ii.minimum_stock - ii.current_quantity) AS shortage
FROM inventory_items ii LEFT JOIN entities e ON e.id = ii.entity_id
WHERE ii.is_active = true AND ii.minimum_stock IS NOT NULL AND ii.current_quantity <= ii.minimum_stock
ORDER BY (ii.minimum_stock - ii.current_quantity) DESC;

CREATE OR REPLACE VIEW public.v_payroll_summary
WITH (security_invoker = on) AS
SELECT pp.entity_id, e.name AS entity_name, pp.id AS period_id, pp.start_date, pp.end_date, pp.status,
    count(ps.employee_id) AS employee_count,
    sum(ps.gross_pay) AS total_gross, sum(ps.tss) AS total_tss,
    sum(ps.isr) AS total_isr, sum(ps.total_benefits) AS total_benefits, sum(ps.net_pay) AS total_net
FROM ((payroll_periods pp LEFT JOIN payroll_snapshots ps ON ps.period_id = pp.id)
  LEFT JOIN entities e ON e.id = pp.entity_id)
GROUP BY pp.entity_id, e.name, pp.id, pp.start_date, pp.end_date, pp.status
ORDER BY pp.start_date DESC;

CREATE OR REPLACE VIEW public.v_transactions_by_cost_center
WITH (security_invoker = on) AS
SELECT t.entity_id, e.name AS entity_name,
    (date_trunc('month', t.transaction_date::timestamp with time zone))::date AS month,
    t.cost_center, t.currency, sum(t.amount) AS total_amount, count(*) AS transaction_count
FROM transactions t LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false
GROUP BY t.entity_id, e.name, date_trunc('month', t.transaction_date::timestamp with time zone), t.cost_center, t.currency
ORDER BY (date_trunc('month', t.transaction_date::timestamp with time zone))::date DESC, t.cost_center;

CREATE OR REPLACE VIEW public.v_transactions_with_dop
WITH (security_invoker = on) AS
SELECT t.id, t.legacy_id, t.transaction_date, t.master_acct_code, t.project_code, t.cbs_code,
    t.description, t.currency, t.amount, t.itbis, t.pay_method, t.document, t.name, t.comments,
    t.is_void, t.void_reason, t.voided_at, t.created_at, t.updated_at, t.rnc, t.is_internal,
    t.dgii_tipo_bienes_servicios, t.itbis_retenido, t.isr_retenido, t.dgii_tipo_ingreso,
    t.dgii_tipo_anulacion, t.transaction_direction, t.cost_center, t.account_id, t.project_id,
    t.cbs_id, t.destination_acct_code, t.due_date, t.destination_amount, t.itbis_override_reason,
    t.exchange_rate, t.purchase_date, t.exchange_rate_used, t.amount_base_currency, t.entity_id,
    e.name AS entity_name,
    CASE WHEN t.currency = 'DOP' THEN t.amount ELSE COALESCE(t.amount_base_currency, t.amount) END AS amount_dop
FROM transactions t LEFT JOIN entities e ON e.id = t.entity_id
WHERE t.is_void = false;

CREATE OR REPLACE VIEW public.v_trial_balance
WITH (security_invoker = on) AS
SELECT j.entity_id, e.name AS entity_name, ca.account_code, ca.account_name, ca.account_type,
    COALESCE(sum(jl.debit), 0) AS total_debits,
    COALESCE(sum(jl.credit), 0) AS total_credits,
    (COALESCE(sum(jl.debit), 0) - COALESCE(sum(jl.credit), 0)) AS balance
FROM ((chart_of_accounts ca
  LEFT JOIN journal_lines jl ON jl.account_id = ca.id)
  LEFT JOIN journals j ON (j.id = jl.journal_id AND j.posted = true))
  LEFT JOIN entities e ON e.id = j.entity_id
WHERE ca.allow_posting = true AND ca.deleted_at IS NULL
GROUP BY j.entity_id, e.name, ca.id, ca.account_code, ca.account_name, ca.account_type
ORDER BY ca.account_code;
