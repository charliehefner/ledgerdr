

## Plan: Fix "To Distribute" calculation

**Current formula (wrong):** `Variance = Forecast - Actual`

**Correct formula:** `To Distribute = Forecast - Actual - Sum(month_1..month_12)`

When fully distributed across months, To Distribute = 0.

### Changes

**`src/components/budget/BudgetGrid.tsx`**

1. **Row-level calculation** (line ~297): Change variance computation to:
   ```
   const monthsSum = MONTH_KEYS.reduce((s, mk) => s + (bl?.[mk] ?? 0), 0);
   const toDistribute = forecastVal - actualVal - monthsSum;
   ```

2. **Totals row** (line ~192): Change `totalVariance` to:
   ```
   const totalToDistribute = totals.forecast - totals.actual - totals.months.reduce((a,b) => a+b, 0);
   ```

3. **Header label** (line ~281-283): Change `t("budget.variance")` to `t("budget.toDistribute")`

4. **Export data** (lines ~209, 222, 233): Update column header key and formula in `buildExportData` to use `toDistribute` with the new formula.

5. **All variable names**: Rename `variance`/`totalVariance` to `toDistribute`/`totalToDistribute` throughout.

**`src/i18n/en.ts`** — Change `"budget.variance"` to `"budget.toDistribute": "To Distribute"`

**`src/i18n/es.ts`** — Change `"budget.variance"` to `"budget.toDistribute": "Por Distribuir"`

