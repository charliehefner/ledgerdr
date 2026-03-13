
-- Returns per-account debit/credit totals from posted journal lines,
-- split by journal currency, for a given date range.
CREATE OR REPLACE FUNCTION public.account_balances_from_journals(
  p_start date DEFAULT NULL,
  p_end   date DEFAULT NULL
)
RETURNS TABLE (
  account_code varchar,
  account_name text,
  account_type text,
  currency     varchar,
  total_debit  numeric,
  total_credit numeric,
  balance      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
  WHERE l.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
  GROUP BY a.account_code, a.account_name, a.account_type, COALESCE(j.currency, 'DOP')
  ORDER BY a.account_code, currency;
$$;
