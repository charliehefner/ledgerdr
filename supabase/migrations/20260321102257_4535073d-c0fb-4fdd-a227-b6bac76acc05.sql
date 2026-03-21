
-- Backfill exchange_rate on USD transactions using closest BCRD rate
UPDATE transactions t
SET exchange_rate = (
  SELECT er.sell_rate
  FROM exchange_rates er
  WHERE er.currency_pair = 'USD/DOP'
    AND er.rate_date <= t.transaction_date
  ORDER BY er.rate_date DESC
  LIMIT 1
)
WHERE t.currency = 'USD'
  AND (t.exchange_rate IS NULL OR t.exchange_rate = 0);

-- Backfill exchange_rate on USD journals using closest BCRD rate
UPDATE journals j
SET exchange_rate = (
  SELECT er.sell_rate
  FROM exchange_rates er
  WHERE er.currency_pair = 'USD/DOP'
    AND er.rate_date <= j.journal_date
  ORDER BY er.rate_date DESC
  LIMIT 1
)
WHERE j.currency = 'USD'
  AND j.deleted_at IS NULL
  AND (j.exchange_rate IS NULL OR j.exchange_rate = 0 OR j.exchange_rate = 1);
