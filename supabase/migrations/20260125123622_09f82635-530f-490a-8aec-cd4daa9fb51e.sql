-- =============================================
-- FULL MIGRATION: Create core accounting tables
-- =============================================

-- 1. ACCOUNTS TABLE (Chart of Accounts)
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  english_description text NOT NULL,
  spanish_description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants can view accounts" ON public.accounts
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins have full access to accounts" ON public.accounts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. PROJECTS TABLE
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  english_description text NOT NULL,
  spanish_description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants can view projects" ON public.projects
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins have full access to projects" ON public.projects
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. CBS CODES TABLE
CREATE TABLE public.cbs_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  english_description text NOT NULL,
  spanish_description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cbs_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants can view cbs_codes" ON public.cbs_codes
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins have full access to cbs_codes" ON public.cbs_codes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. TRANSACTIONS TABLE (Main ledger)
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_id integer UNIQUE, -- Maps to old DigitalOcean ID for attachment migration
  transaction_date date NOT NULL,
  master_acct_code text,
  project_code text,
  cbs_code text,
  description text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'DOP',
  amount numeric NOT NULL DEFAULT 0,
  itbis numeric,
  pay_method text,
  document text,
  name text,
  comments text,
  is_void boolean NOT NULL DEFAULT false,
  void_reason text,
  voided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Accountants can view all transactions
CREATE POLICY "Accountants can view transactions" ON public.transactions
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- Accountants can insert transactions
CREATE POLICY "Accountants can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

-- Accountants can update transactions (for edits, voiding)
CREATE POLICY "Accountants can update transactions" ON public.transactions
  FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));

-- Admins have full access
CREATE POLICY "Admins have full access to transactions" ON public.transactions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX idx_transactions_legacy_id ON public.transactions(legacy_id);