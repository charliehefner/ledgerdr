
-- Create ap_ar_payments table for payment audit trail
CREATE TABLE public.ap_ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.ap_ar_documents(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  journal_id UUID REFERENCES public.journals(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ap_ar_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view payments"
  ON public.ap_ar_payments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/management/accountant can insert payments"
  ON public.ap_ar_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Create cost-center-aware version of account_balances_from_journals
CREATE OR REPLACE FUNCTION public.account_balances_from_journals(
  p_start date DEFAULT NULL::date,
  p_end date DEFAULT NULL::date,
  p_cost_center text DEFAULT NULL::text
)
RETURNS TABLE(
  account_code character varying,
  account_name text,
  account_type text,
  currency character varying,
  total_debit numeric,
  total_credit numeric,
  balance numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    COALESCE(j.currency, 'DOP') AS currency,
    COALESCE(SUM(l.debit), 0)  AS total_debit,
    COALESCE(SUM(l.credit), 0) AS total_credit,
    COALESCE(SUM(l.debit - l.credit), 0) AS balance
  FROM journal_lines l
  JOIN journals j ON j.id = l.journal_id
    AND j.posted = true
    AND j.deleted_at IS NULL
  JOIN chart_of_accounts a ON a.id = l.account_id
    AND a.deleted_at IS NULL
  LEFT JOIN transactions t ON t.id = j.transaction_source_id
  WHERE l.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
    AND (p_cost_center IS NULL OR p_cost_center = 'general' OR t.cost_center = p_cost_center)
  GROUP BY a.account_code, a.account_name, a.account_type, COALESCE(j.currency, 'DOP')
  ORDER BY a.account_code, currency;
$$;
