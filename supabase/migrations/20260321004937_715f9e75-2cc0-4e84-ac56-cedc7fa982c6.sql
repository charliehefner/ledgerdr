-- Backfill NULLs
UPDATE transactions SET itbis = 0 WHERE itbis IS NULL;

-- Set default and NOT NULL
ALTER TABLE transactions ALTER COLUMN itbis SET DEFAULT 0;
ALTER TABLE transactions ALTER COLUMN itbis SET NOT NULL;

-- Non-negative tax check
ALTER TABLE transactions ADD CONSTRAINT chk_taxes_non_negative
  CHECK (itbis >= 0 AND itbis_retenido >= 0 AND isr_retenido >= 0);