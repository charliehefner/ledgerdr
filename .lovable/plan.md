

## Problem

The Budget grid's "Actual" column sums transaction amounts without currency conversion. A USD 1,000 transaction is counted as 1,000 instead of ~60,000 DOP. The `exchange_rate` field on each transaction stores the conversion rate at time of entry.

## Solution

Modify the actuals query in `BudgetGrid.tsx` to also fetch `currency` and `exchange_rate`, then multiply non-DOP amounts by their exchange rate before summing.

### Changes

**`src/components/budget/BudgetGrid.tsx`** (lines 107-126)

- Update the `.select()` to include `currency` and `exchange_rate` alongside `cbs_code`, `master_acct_code`, and `amount`
- In the aggregation loop, convert each transaction: if `currency !== 'DOP'`, multiply `amount` by `exchange_rate` (defaulting to 1 if missing)

```text
Before:  map[key] = (map[key] || 0) + (tx.amount || 0)
After:   rate = (tx.currency !== 'DOP' && tx.exchange_rate) ? tx.exchange_rate : 1
         map[key] = (map[key] || 0) + ((tx.amount || 0) * rate)
```

**`src/components/budget/ActualDetailDialog.tsx`** — Same conversion should apply there if it shows individual amounts or totals. Will check and update accordingly.

This matches how financial statements already handle multi-currency conversion (multiply by exchange rate to get RD$ equivalent).

