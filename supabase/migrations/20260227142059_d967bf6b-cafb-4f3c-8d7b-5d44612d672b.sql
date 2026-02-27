
-- 1. Add due_date to transactions for AR/AP aging
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date date;

-- 2. Bank reconciliation tables
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text,
  chart_account_id uuid REFERENCES public.chart_of_accounts(id),
  currency varchar DEFAULT 'DOP',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date date NOT NULL,
  description text,
  reference text,
  amount numeric NOT NULL DEFAULT 0,
  balance numeric,
  is_reconciled boolean DEFAULT false,
  matched_journal_id uuid REFERENCES public.journals(id),
  matched_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz DEFAULT now()
);

-- 3. Recurring journal templates
CREATE TABLE public.recurring_journal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'biweekly')),
  next_run_date date NOT NULL,
  is_active boolean DEFAULT true,
  currency varchar DEFAULT 'DOP',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.recurring_journal_template_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recurring_journal_templates(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  project_code text,
  cbs_code text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS for bank_accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access bank_accounts" ON public.bank_accounts FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access bank_accounts" ON public.bank_accounts FOR ALL USING (has_role(auth.uid(), 'management')) WITH CHECK (has_role(auth.uid(), 'management'));
CREATE POLICY "Accountants full access bank_accounts" ON public.bank_accounts FOR ALL USING (has_role(auth.uid(), 'accountant')) WITH CHECK (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewers read bank_accounts" ON public.bank_accounts FOR SELECT USING (has_role(auth.uid(), 'viewer'));

-- RLS for bank_statement_lines
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access bank_lines" ON public.bank_statement_lines FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access bank_lines" ON public.bank_statement_lines FOR ALL USING (has_role(auth.uid(), 'management')) WITH CHECK (has_role(auth.uid(), 'management'));
CREATE POLICY "Accountants full access bank_lines" ON public.bank_statement_lines FOR ALL USING (has_role(auth.uid(), 'accountant')) WITH CHECK (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewers read bank_lines" ON public.bank_statement_lines FOR SELECT USING (has_role(auth.uid(), 'viewer'));

-- RLS for recurring_journal_templates
ALTER TABLE public.recurring_journal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access recurring_templates" ON public.recurring_journal_templates FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access recurring_templates" ON public.recurring_journal_templates FOR ALL USING (has_role(auth.uid(), 'management')) WITH CHECK (has_role(auth.uid(), 'management'));
CREATE POLICY "Accountants full access recurring_templates" ON public.recurring_journal_templates FOR ALL USING (has_role(auth.uid(), 'accountant')) WITH CHECK (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewers read recurring_templates" ON public.recurring_journal_templates FOR SELECT USING (has_role(auth.uid(), 'viewer'));

-- RLS for recurring_journal_template_lines
ALTER TABLE public.recurring_journal_template_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access recurring_lines" ON public.recurring_journal_template_lines FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Management full access recurring_lines" ON public.recurring_journal_template_lines FOR ALL USING (has_role(auth.uid(), 'management')) WITH CHECK (has_role(auth.uid(), 'management'));
CREATE POLICY "Accountants full access recurring_lines" ON public.recurring_journal_template_lines FOR ALL USING (has_role(auth.uid(), 'accountant')) WITH CHECK (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Viewers read recurring_lines" ON public.recurring_journal_template_lines FOR SELECT USING (has_role(auth.uid(), 'viewer'));
