

## Auto-populate CRM + Rename Tab

### 1. Rename nav item
- `es.ts`: `nav.contacts` → `"CRM/Contactos"`
- `en.ts`: `nav.contacts` → `"CRM/Contacts"`

### 2. One-time SQL migration to seed contacts

A single migration that:
1. Groups transactions by RNC (when present) — picks the most-used name variant
2. Groups remaining (no RNC) by case-insensitive name — picks the most-used casing
3. Skips purely numeric names (e.g. "629.3")
4. Skips names already in `contacts`
5. Inserts all as `contact_type = 'supplier'`

```sql
-- Seed contacts from transaction history (one-time)
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
```

This deduplicates ~148 entries down to unique contacts, merging variants like "JORD DOMINICANA SRL" and "Jord Dominicana" (same RNC `132214048`).

### 3. Remove "Import from History" button from Contacts.tsx
No UI button needed — the migration runs once during deployment.

### Files changed
| File | Change |
|------|--------|
| Migration SQL | One-time seed query |
| `src/i18n/es.ts` | Rename nav label |
| `src/i18n/en.ts` | Rename nav label |

