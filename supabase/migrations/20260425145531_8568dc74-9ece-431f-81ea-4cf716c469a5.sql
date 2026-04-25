CREATE OR REPLACE FUNCTION public.compute_period_fx_translation(
  p_end_date date,
  p_closing_rate numeric,
  p_entity_id uuid DEFAULT NULL
) RETURNS TABLE (
  account_id uuid,
  account_code varchar,
  account_name text,
  usd_balance numeric,
  book_dop_balance numeric,
  reported_dop_balance numeric,
  fx_impact numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH usd_lines AS (
    SELECT
      jl.account_id,
      (jl.debit - jl.credit) AS usd_delta,
      (jl.debit - jl.credit) * COALESCE(j.exchange_rate, 1) AS dop_delta
    FROM journal_lines jl
    JOIN journals j ON j.id = jl.journal_id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE j.posted = true
      AND j.deleted_at IS NULL
      AND jl.deleted_at IS NULL
      AND coa.deleted_at IS NULL
      AND j.journal_date <= p_end_date
      AND j.currency = 'USD'
      AND coa.currency = 'USD'
      AND coa.account_type IN ('ASSET','LIABILITY','EQUITY')
      AND (p_entity_id IS NULL OR j.entity_id = p_entity_id)
  )
  SELECT
    coa.id,
    coa.account_code,
    coa.account_name,
    SUM(ul.usd_delta)                               AS usd_balance,
    SUM(ul.dop_delta)                               AS book_dop_balance,
    SUM(ul.usd_delta) * p_closing_rate              AS reported_dop_balance,
    (SUM(ul.usd_delta) * p_closing_rate) - SUM(ul.dop_delta) AS fx_impact
  FROM usd_lines ul
  JOIN chart_of_accounts coa ON coa.id = ul.account_id
  GROUP BY coa.id, coa.account_code, coa.account_name
  HAVING SUM(ul.usd_delta) <> 0;
$$;

GRANT EXECUTE ON FUNCTION public.compute_period_fx_translation(date, numeric, uuid) TO authenticated;