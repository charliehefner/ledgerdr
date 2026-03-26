

## Show Clashing Transaction Details in Duplicate Error

### Problem
When a duplicate NCF is detected, the error just says "Duplicate transaction detected" without identifying **which** existing transaction has that NCF. The user can't tell what's clashing.

### Fix
Two small changes in `src/components/transactions/TransactionForm.tsx`:

1. **Change `checkForDuplicate` to return the clashing transaction** (or `null`) instead of a boolean:
   - Find the matching transaction from `existingTransactions` using `.find()` instead of `.some()`
   - Return the full transaction object so we can display its `legacy_id`, date, name, and amount

2. **Update the submit handler** to show a detailed error message:
   - Instead of the generic `t('txForm.duplicate')`, show: `"Duplicado: NCF ya usado en transacción #270 — Ferretería Pérez, 15/02/2025, 1,500.00 DOP"`
   - Include: transaction number (`legacy_id`), name, date, and amount

3. **Update i18n strings** in `src/i18n/es.ts` and `src/i18n/en.ts` — not strictly needed since we'll build the message dynamically, but we can keep the base key as fallback.

### Files Changed
- `src/components/transactions/TransactionForm.tsx` — update `checkForDuplicate` and its call site (~10 lines)

