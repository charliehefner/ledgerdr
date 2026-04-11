-- Add balance_dop to account_balances_from_journals.
-- For DOP journals: balance_dop = balance (no conversion needed).
-- For USD/EUR journals: each line is multiplied by its own stored exchange rate
-- (journals.exchange_rate if set, else transactions.exchange_rate).
-- Lines that have no stored exchange rate contribute NULL to the SUM and are
-- therefore excluded from balance_dop (SUM ignores NULLs). The frontend detects
-- this case (balance_dop=0 with balance≠0) and falls back to the user-provided
-- fallback rate for those accounts.

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
  balance_dop   numeric   -- NEW: converted to DOP using per-journal stored exchange rates
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
    -- Per-entry DOP conversion using stored rates where available.
    -- DOP lines: pass through as-is.
    -- Non-DOP lines with a rate: multiply by that rate.
    -- Non-DOP lines without a rate: NULL → ignored by SUM.
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
