

# Fix: Missing `purchase_date` Column

Same issue as `exchange_rate` — the column is referenced in code but doesn't exist in the database yet.

## Plan

| # | Task | Detail |
|---|------|--------|
| 1 | Add `purchase_date` column | `ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS purchase_date date;` |

Single migration, no code changes needed.

