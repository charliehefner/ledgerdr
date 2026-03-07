
-- 1. Revaluation log table
CREATE TABLE public.revaluation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id),
  journal_id uuid REFERENCES public.journals(id),
  revaluation_date date NOT NULL,
  closing_rate numeric NOT NULL,
  total_adjustment numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.revaluation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read revaluation_log"
ON public.revaluation_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/accountant can insert revaluation_log"
ON public.revaluation_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- 2. Foreign currency balances function
CREATE OR REPLACE FUNCTION public.foreign_currency_balances(p_start date, p_end date)
RETURNS TABLE(
  account_id uuid,
  account_code varchar,
  account_name text,
  usd_balance numeric,
  booked_dop_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id AS account_id,
    a.account_code,
    a.account_name,
    SUM(l.debit - l.credit) AS usd_balance,
    SUM((l.debit - l.credit) * COALESCE(j.exchange_rate, 1)) AS booked_dop_total
  FROM journal_lines l
  JOIN journals j ON j.id = l.journal_id
    AND j.posted = true
    AND j.deleted_at IS NULL
    AND j.currency = 'USD'
    AND j.journal_date BETWEEN p_start AND p_end
  JOIN chart_of_accounts a ON a.id = l.account_id
    AND a.deleted_at IS NULL
  WHERE l.deleted_at IS NULL
  GROUP BY a.id, a.account_code, a.account_name
  HAVING ABS(SUM(l.debit - l.credit)) > 0.005
  ORDER BY a.account_code;
$$;

-- 3. ADJ journal sequence
CREATE SEQUENCE IF NOT EXISTS journal_seq_adj START WITH 1 INCREMENT BY 1;

-- 4. Update generate_journal_number trigger to handle ADJ
CREATE OR REPLACE FUNCTION public.generate_journal_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  seq_num bigint;
  prefix text;
BEGIN
  prefix := COALESCE(NEW.journal_type, 'GJ');
  CASE prefix
    WHEN 'PJ'  THEN SELECT nextval('journal_seq_pj') INTO seq_num;
    WHEN 'SJ'  THEN SELECT nextval('journal_seq_sj') INTO seq_num;
    WHEN 'PRJ' THEN SELECT nextval('journal_seq_prj') INTO seq_num;
    WHEN 'CDJ' THEN SELECT nextval('journal_seq_cdj') INTO seq_num;
    WHEN 'CRJ' THEN SELECT nextval('journal_seq_crj') INTO seq_num;
    WHEN 'DEP' THEN SELECT nextval('journal_seq_dep') INTO seq_num;
    WHEN 'ADJ' THEN SELECT nextval('journal_seq_adj') INTO seq_num;
    ELSE SELECT nextval('journals_journal_number_seq') INTO seq_num;
  END CASE;
  NEW.journal_number := prefix || '-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$function$;
