

## Fix: ITBIS null constraint violation

### Problem
When creating a transaction without ITBIS (fuel, transportation, etc.), the form sends `undefined` for itbis. The `createTransaction` function in `api.ts` converts this to `null`, but the database column `itbis` has a `NOT NULL DEFAULT 0` constraint, causing the insert to fail.

### Root Cause
`api.ts` line ~299: `itbis: transaction.itbis || null` — should use `?? 0` instead of `|| null` to respect the DB default.

Same issue exists for `itbis_retenido` and `isr_retenido` on the next lines.

### Fix

**`src/lib/api.ts`** — In `createTransaction`, change:
- `itbis: transaction.itbis || null` → `itbis: transaction.itbis ?? 0`
- `itbis_retenido: transaction.itbis_retenido || null` → `itbis_retenido: transaction.itbis_retenido ?? 0`
- `isr_retenido: transaction.isr_retenido || null` → `isr_retenido: transaction.isr_retenido ?? 0`

One file, three line changes.

