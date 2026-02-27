

## Wire Comparison Columns into P&L and Balance Sheet

The P&L already has the Compare toggle, date pickers, and `compAccountTotals` computed — but the table only shows current-period columns. The Balance Sheet has none of this yet. Here is the plan to finish wiring both.

---

### 1. ProfitLossView.tsx — Add comparison columns to table

- Extend `StatementRow` type to include `compRd` and `compUs` fields
- During statement row construction, look up each account in `compAccountTotals` and populate `compRd`/`compUs`; compute section/intermediate totals for comparison period too
- When `compareEnabled` is true, add 3 extra table header columns: **Prior RD$**, **Var $**, **Var %**
- Update `colCount` to account for extra columns
- Each row type (account, sectionTotal, intermediateTotal, netIncome, categorySubtotal) renders the 3 extra cells when comparison is on
- Variance = current - prior; Var% = (current - prior) / |prior| * 100, or "—" when prior is zero
- Update Excel and PDF export to include the comparison columns when enabled

### 2. BalanceSheetView.tsx — Add comparison support

- Add the same state: `compareEnabled`, `compAsOfDate` (single date, defaults to one year prior)
- Add a second query for comparison-period journal lines (up to `compAsOfDate`)
- Compute comparison balances the same way as current balances
- Add Compare toggle + date picker to toolbar
- When enabled, render extra columns: **Prior RD$**, **Var $**, **Var %**
- Update Excel/PDF export

### 3. I18n additions

- `pl.priorRd` / `pl.variance` / `pl.variancePct` (both languages)
- `bs.compare` / `bs.priorAsOf` / `bs.priorRd` / `bs.variance` / `bs.variancePct`

---

### Files touched

| File | Change |
|---|---|
| `ProfitLossView.tsx` | Add comp columns to StatementRow, table, and exports |
| `BalanceSheetView.tsx` | Add comparison state, query, columns, exports |
| `en.ts` / `es.ts` | Add comparison i18n keys |

