

## Stage 1: Unlinked Transaction Warning Banners

### What
Add a warning banner to the **Profit & Loss**, **Balance Sheet**, and **Trial Balance** views that alerts when transactions exist in the selected date range that have no corresponding journal entry. This gives immediate visibility into data gaps without changing any financial logic.

### How

**1. Create a shared hook: `src/hooks/useUnlinkedTransactionCount.ts`**

A reusable hook that accepts a date range (start/end) and returns the count of transactions that have no matching `journals.transaction_source_id`. Query logic:
- Count transactions where `is_void = false` and `transaction_date` falls in range
- Left-join or NOT IN against `journals.transaction_source_id`
- Since Supabase JS client doesn't support left-join counts easily, use a simple RPC or two queries: total transaction count vs count of transactions whose `id` appears in `journals.transaction_source_id`

Simplest approach: two lightweight count queries run in parallel:
```sql
-- Total non-void transactions in range
SELECT count(*) FROM transactions WHERE is_void = false AND transaction_date BETWEEN ...

-- Transactions that DO have journals
SELECT count(DISTINCT transaction_source_id) FROM journals WHERE transaction_source_id IS NOT NULL AND journal_date BETWEEN ...
```

The difference = unlinked count.

**2. Create a shared component: `src/components/accounting/UnlinkedTransactionsWarning.tsx`**

A small amber Alert banner using the existing `Alert` UI component. Shows:
- Icon: `AlertTriangle`
- Message (bilingual): "X transactions in this period have no journal entry. Financial reports may be incomplete. Generate journals to resolve."
- Only renders when unlinked count > 0

**3. Add the banner to three views**

Insert the `<UnlinkedTransactionsWarning>` component between the filter controls and the report table in:
- `ProfitLossView.tsx` — after line 645 (after filter/export bar, before `isLoading` check)
- `BalanceSheetView.tsx` — after line 504 (after filter bar, before `isLoading` check)
- `TrialBalanceView.tsx` — similarly before the table

Each passes its active date range to the hook.

### Files changed
| File | Change |
|------|--------|
| `src/hooks/useUnlinkedTransactionCount.ts` | New hook — two count queries |
| `src/components/accounting/UnlinkedTransactionsWarning.tsx` | New warning banner component |
| `src/components/accounting/ProfitLossView.tsx` | Import + render banner |
| `src/components/accounting/BalanceSheetView.tsx` | Import + render banner |
| `src/components/accounting/TrialBalanceView.tsx` | Import + render banner |

