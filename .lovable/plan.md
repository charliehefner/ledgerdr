

## Plan: Add Pay Method Filter to Financial (Ledger) Report

The Accounting Reports "Transaction Detail" view (`AccountingReportsView.tsx`) has a filter dialog with date range, cost center, account, project, CBS, and supplier filters. You need a **Pay Method** filter added to this dialog so you can filter transactions by payment method (e.g., `cc_management`) within a date range.

### Changes to `src/components/accounting/AccountingReportsView.tsx`

1. **Add `payMethod` to the `Filters` type and `emptyFilters`** — default value `"all"`.

2. **Add `payMethod` filter to the Supabase query** — when not `"all"`, add `.eq("pay_method", activeFilters.payMethod)` to the query builder (server-side filter, like account/project).

3. **Add Pay Method column to the results table** — add `"pay_method"` to `colHeaders` and render it in each row, also make it sortable.

4. **Add Pay Method to the filter dialog** — add a `<Select>` dropdown in the 4-column grid with options:
   - All
   - Transfer BDI
   - Transfer BHD
   - Cash / Efectivo
   - CC Management
   - CC Agrícola
   - CC Industrial

5. **Add Pay Method to active filter labels** — show the selected pay method as a badge when active.

6. **Include Pay Method in Excel and PDF exports** — add a column for pay method in both export functions.

### Summary of touched areas
- `Filters` type: add `payMethod: string`
- `emptyFilters`: add `payMethod: "all"`
- Query builder: add `.eq("pay_method", ...)` condition
- `SortKey` type: add `"pay_method"`
- `colHeaders`: add pay_method column
- Filter dialog: add Select dropdown
- `activeFilterLabels`: add pay method label
- Excel export: add pay_method column
- PDF export: add pay_method column

