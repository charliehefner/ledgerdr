
-- ============================================================
-- PART 1: Add DEFAULT current_user_entity_id() to 6 tables
-- ============================================================

ALTER TABLE public.bank_accounts ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();
ALTER TABLE public.fixed_assets ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();
ALTER TABLE public.contacts ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();
ALTER TABLE public.approval_policies ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();
ALTER TABLE public.approval_requests ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();
ALTER TABLE public.hr_audit_log ALTER COLUMN entity_id SET DEFAULT current_user_entity_id();

-- Backfill NULL entity_id rows with E1
UPDATE public.bank_accounts SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.fixed_assets SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.contacts SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.approval_policies SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.approval_requests SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;
UPDATE public.hr_audit_log SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf' WHERE entity_id IS NULL;

-- ============================================================
-- PART 2: Drop old-style duplicate RLS policies
-- ============================================================

-- accounting_periods
DROP POLICY IF EXISTS "Admins have full access to accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Management has full access to accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Accountants can insert accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Accountants can update accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Accountants can view accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Supervisors can view accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Viewers can view accounting periods" ON public.accounting_periods;

-- ap_ar_documents
DROP POLICY IF EXISTS "Admin can delete ap_ar_documents" ON public.ap_ar_documents;
DROP POLICY IF EXISTS "Admin/accountant can insert ap_ar_documents" ON public.ap_ar_documents;
DROP POLICY IF EXISTS "Admin/accountant can update ap_ar_documents" ON public.ap_ar_documents;
DROP POLICY IF EXISTS "Authenticated users can read ap_ar_documents" ON public.ap_ar_documents;

-- ap_ar_payments
DROP POLICY IF EXISTS "Admin/management/accountant can insert payments" ON public.ap_ar_payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.ap_ar_payments;

-- bank_accounts
DROP POLICY IF EXISTS "Admins full access bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Accountants full access bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Management full access bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Viewers read bank_accounts" ON public.bank_accounts;

-- budget_lines
DROP POLICY IF EXISTS "budget_lines_select" ON public.budget_lines;
DROP POLICY IF EXISTS "budget_lines_insert" ON public.budget_lines;
DROP POLICY IF EXISTS "budget_lines_update" ON public.budget_lines;
DROP POLICY IF EXISTS "budget_lines_delete" ON public.budget_lines;

-- chart_of_accounts
DROP POLICY IF EXISTS "Admins have full access to chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Management has full access to chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Accountants can insert chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Accountants can update chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Accountants can view chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Supervisors can view chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Viewers can view chart of accounts" ON public.chart_of_accounts;

-- contacts
DROP POLICY IF EXISTS "Admin/Management can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admin/Management/Accountant can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admin/Management/Accountant can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contacts;

-- fixed_assets
DROP POLICY IF EXISTS "Admins have full access to fixed assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "Management has full access to fixed assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "Accountants can manage fixed assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "Supervisors can view fixed assets" ON public.fixed_assets;
DROP POLICY IF EXISTS "Viewers can view fixed assets" ON public.fixed_assets;

-- journals
DROP POLICY IF EXISTS "Admins have full access to journals" ON public.journals;
DROP POLICY IF EXISTS "Management has full access to journals" ON public.journals;
DROP POLICY IF EXISTS "Accountants can insert journals" ON public.journals;
DROP POLICY IF EXISTS "Accountants can update journals" ON public.journals;
DROP POLICY IF EXISTS "Accountants can view journals" ON public.journals;
DROP POLICY IF EXISTS "Supervisors can view journals" ON public.journals;
DROP POLICY IF EXISTS "Viewers can view journals" ON public.journals;

-- journal_lines
DROP POLICY IF EXISTS "Admins have full access to journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Management has full access to journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Accountants can insert journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Accountants can update journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Accountants can view journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Supervisors can view journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Viewers can view journal lines" ON public.journal_lines;

-- payroll_snapshots
DROP POLICY IF EXISTS "Admins have full access to payroll snapshots" ON public.payroll_snapshots;
DROP POLICY IF EXISTS "Accountants can view payroll snapshots" ON public.payroll_snapshots;

-- ============================================================
-- PART 3: Add entity-scoped RLS to tables that lack them
-- ============================================================

-- approval_policies: replace with entity-scoped
DROP POLICY IF EXISTS "Admin full access" ON public.approval_policies;
DROP POLICY IF EXISTS "Management can view" ON public.approval_policies;

CREATE POLICY "Admin full access" ON public.approval_policies FOR ALL TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "Management full access" ON public.approval_policies FOR ALL TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "Accountant can view" ON public.approval_policies FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "Viewer can view" ON public.approval_policies FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id));

-- approval_requests: replace with entity-scoped
DROP POLICY IF EXISTS "Admin full access" ON public.approval_requests;
DROP POLICY IF EXISTS "Management can view and action" ON public.approval_requests;
DROP POLICY IF EXISTS "Submitter can view own requests" ON public.approval_requests;

CREATE POLICY "Admin full access" ON public.approval_requests FOR ALL TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "Management full access" ON public.approval_requests FOR ALL TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "Submitter can view own" ON public.approval_requests FOR SELECT TO authenticated
USING (auth.uid() = submitted_by);

-- hr_audit_log: replace with entity-scoped
DROP POLICY IF EXISTS "Admin full access" ON public.hr_audit_log;
DROP POLICY IF EXISTS "Management can view HR audit" ON public.hr_audit_log;
DROP POLICY IF EXISTS "Accountant can view HR audit" ON public.hr_audit_log;

CREATE POLICY "Admin full access" ON public.hr_audit_log FOR ALL TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "Management can view" ON public.hr_audit_log FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "Accountant can view" ON public.hr_audit_log FOR SELECT TO authenticated
USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));
