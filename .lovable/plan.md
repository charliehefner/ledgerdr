

# Automated Tests Plan

The testing infrastructure (vitest, jsdom, setup file) is already in place. We will add unit tests for the key logic areas that have caused recent bugs.

## What We Will Test

### 1. AP/AR Account Assignment Logic (new file)
**`src/components/transactions/__tests__/apArAccountLogic.test.ts`**

Extract the AP/AR account code selection logic into a pure testable function, then test:
- Credit purchase → returns `2101`
- Sale with due date → returns `1210`
- Advance (1690 account) → returns `1690`
- Default due date calculation: credit with no due_date → +30 days
- `shouldCreateApAr` conditions: returns true for credit/due_date, false for transfers/payments

### 2. QuickEntry Auto-Categorization (new file)
**`src/components/accounting/__tests__/quickEntryAutoCategory.test.ts`**

The `matchAutoCategory` function is already pure but not exported. Export it and test:
- "COMISIÓN bancaria" → `6520`
- "IMPUESTO LEY 123" → `6530`
- "ITBIS retenido" → `1650`
- "INTERÉS mensual" → `6510`
- Unmatched description → `null`
- Null description → `null`

### 3. Journal Generation Hook (new file)
**`src/components/accounting/__tests__/useJournalGeneration.test.ts`**

Mock Supabase and test:
- `countUnlinked` calls the correct RPC
- `generate` handles success with created count
- `generate` handles skipped entries with toast warning
- `generate` handles errors gracefully

## Implementation Details

### Extracting testable logic
The AP/AR logic in `TransactionForm.tsx` is embedded in a 400-line submit handler. We will:
1. Extract `getApArAccountCode(isAdvance, direction)` and `shouldCreateApAr(form, isTransfer)` into `src/components/transactions/apArUtils.ts`
2. Export `matchAutoCategory` from `QuickEntryDialog.tsx`
3. Update the original files to import from the new utility

### Mocking strategy
- Supabase calls: mock with `vi.mock('@/integrations/supabase/client')`
- React Query: mock `useQueryClient`
- Toast: mock `@/hooks/use-toast`

### Files changed/created
| File | Action |
|------|--------|
| `src/components/transactions/apArUtils.ts` | **Create** — extracted pure functions |
| `src/components/transactions/__tests__/apArUtils.test.ts` | **Create** — tests |
| `src/components/transactions/TransactionForm.tsx` | **Edit** — import from apArUtils |
| `src/components/accounting/QuickEntryDialog.tsx` | **Edit** — export matchAutoCategory |
| `src/components/accounting/__tests__/quickEntryAutoCategory.test.ts` | **Create** — tests |
| `src/components/accounting/__tests__/useJournalGeneration.test.ts` | **Create** — tests |

