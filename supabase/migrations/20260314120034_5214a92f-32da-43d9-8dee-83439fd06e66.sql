-- One-time seed: populate contacts from transaction history
WITH ranked AS (
  SELECT name, rnc,
    COUNT(*) as cnt,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(rnc, LOWER(name))
      ORDER BY COUNT(*) DESC, name
    ) as rn
  FROM transactions
  WHERE name IS NOT NULL AND name != ''
    AND is_void = false
    AND name !~ '^\d+\.?\d*$'
  GROUP BY name, rnc
)
INSERT INTO contacts (name, rnc, contact_type)
SELECT name, rnc, 'supplier'
FROM ranked
WHERE rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE (c.rnc IS NOT NULL AND c.rnc = ranked.rnc)
       OR LOWER(c.name) = LOWER(ranked.name)
  );