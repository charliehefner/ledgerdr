DROP FUNCTION IF EXISTS public.account_balances_from_journals(date, date, text);

CREATE OR REPLACE FUNCTION public.account_balances_from_journals(
  p_start       date DEFAULT NULL::date,
  p_end         date DEFAULT NULL::date,
  p_cost_center text DEFAULT NULL::text
)
RETURNS TABLE(
  account_code  character varying,
  account_name  text,
  account_type  text,
  currency      character varying,
  total_debit   numeric,
  total_credit  numeric,
  balance       numeric,
  balance_dop   numeric
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
    COALESCE(SUM(l.debit),          0) AS total_debit,
    COALESCE(SUM(l.credit),         0) AS total_credit,
    COALESCE(SUM(l.debit - l.credit), 0) AS balance,
    COALESCE(SUM(
      CASE
        WHEN COALESCE(j.currency, 'DOP') = 'DOP'
          THEN l.debit - l.credit
        WHEN COALESCE(j.exchange_rate, t.exchange_rate) IS NOT NULL
          THEN (l.debit - l.credit) * COALESCE(j.exchange_rate, t.exchange_rate)
        ELSE NULL
      END
    ), 0) AS balance_dop
  FROM journal_lines l
  JOIN journals j
    ON  j.id         = l.journal_id
    AND j.posted     = true
    AND j.deleted_at IS NULL
  JOIN chart_of_accounts a
    ON  a.id         = l.account_id
    AND a.deleted_at IS NULL
  LEFT JOIN transactions t
    ON  t.id = j.transaction_source_id
  WHERE l.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
    AND (
      p_cost_center IS NULL
      OR p_cost_center = 'general'
      OR t.cost_center = p_cost_center
    )
  GROUP BY a.account_code, a.account_name, a.account_type, COALESCE(j.currency, 'DOP')
  ORDER BY a.account_code, currency;
$$;