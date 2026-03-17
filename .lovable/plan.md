

# Add Thousand Separators to All Currency Amounts

## Problem
Many currency amounts across the app display without thousand separators (e.g., `12345.00` instead of `12,345.00`). The app already has a proper `formatCurrency()` function in `src/lib/formatters.ts` that uses `Intl.NumberFormat` with thousand separators, but many components bypass it and use `.toFixed(2)` directly.

## Approach
1. **Add a `formatMoney` helper** to `src/lib/formatters.ts` — a lightweight number formatter that adds thousand separators without a currency symbol (for cases where the symbol is already provided or not needed):
   ```ts
   export function formatMoney(n: number): string {
     return n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   }
   ```

2. **Replace `.toFixed(2)` with proper formatting** in all files where the value represents money. Key files (currency-related only, not quantities/hectares/gallons):

   - `src/components/accounting/RecurringEntriesView.tsx` — journal debit/credit totals
   - `src/components/accounting/DGII606Table.tsx` — all amount columns (montoFacturado, itbis, retenciones)
   - `src/components/accounting/DGII607Table.tsx` — same pattern
   - `src/components/inventory/PurchaseHistoryDialog.tsx` — unit_price, total_price
   - `src/components/inventory/PurchaseDialog.tsx` — calculated totals
   - `src/components/hr/PayrollSummary.tsx` — all pay/deduction amounts in Excel export and UI
   - `src/components/hr/IR3ReportView.tsx` — ISR total clipboard copy
   - `src/components/hr/IR17ReportView.tsx` — IR-17 total clipboard copy
   - `src/components/operations/contracts/ContractReport.tsx` — contract amounts using `$${amount.toLocaleString()}` (already has separators but inconsistent format)
   - `src/components/operations/InputUsageReport.tsx` — cost columns

3. **Exclude non-currency `.toFixed(2)` usages** — quantities in units (hectares, gallons, liters, stock units) should keep `.toFixed(2)` since they are not currency. The DGII export files and TSS file that generate fixed-width government report formats will also be left as-is since those require specific numeric formatting.

## Scope
~12 files modified. The `formatCurrency` function (with symbol) is already used correctly in ~25 files — those are fine. This fix targets the remaining files that format money with raw `.toFixed(2)`.

