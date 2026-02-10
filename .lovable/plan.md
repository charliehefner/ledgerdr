

## Add Date Range Preset Dropdown to Purchase Totals Table

### Problem
The Purchase Totals by Account & CBS table currently sums all transactions loaded (up to the row limit), with no independent date restriction. As more transactions accumulate, totals grow indefinitely and become less useful.

### Solution
Add a dropdown selector directly inside the Purchase Totals card header with these preset options:
- **Current Month** (Mes Actual) -- default
- **Past Month** (Mes Anterior)
- **Year to Date** (Ano en Curso)
- **Prior Year** (Ano Anterior)

### How It Works
1. A new state variable `purchaseTotalsPeriod` will default to `"current_month"`.
2. A `Select` dropdown will be placed in the `CardHeader` next to the title.
3. The `accountCbsTotals` calculation will apply its own date filter on `nonVoidedTransactions` (independent of the main table filters) based on the selected period, then apply the existing account/CBS matching logic.
4. Date boundaries will be computed dynamically based on `new Date()` (e.g., current month = first day of current month through today).

### Technical Details

**File: `src/pages/Reports.tsx`**

- Add state: `const [purchaseTotalsPeriod, setPurchaseTotalsPeriod] = useState("current_month");`
- Add a `useMemo` that computes start/end dates from the period selection.
- Change `accountCbsTotals` to filter from `nonVoidedTransactions` (not the already-filtered `transactions`) using the period dates, then apply the account/CBS filter.
- Update the `CardHeader` to include a `Select` dropdown beside the title, styled inline.

**Period date logic:**
- Current Month: Jan 1 of current month through today
- Past Month: first day of previous month through last day of previous month
- YTD: Jan 1 of current year through today
- Prior Year: Jan 1 of previous year through Dec 31 of previous year

**UI layout for the card header:**
```text
+-----------------------------------------------------+
| Purchase Totals by Account & CBS   [Mes Actual v]   |
+-----------------------------------------------------+
| Account / CBS Pair  | Transactions | DOP    | USD   |
| ...                                                  |
```
