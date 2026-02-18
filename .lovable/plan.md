

# Replace Periods Tab with Accounting Reports

## Overview
Remove the "Periodos" tab from the Accounting page and replace it with an "Informes Contables" (Accounting Reports) tab. This tab will show a button that opens a report configuration dialog where the accountant can set filters (date range, cost center, account, project, CBS, supplier) and then view or export the results.

## What Gets Removed
- The `PeriodsView` component import and tab from `Accounting.tsx`
- The `PeriodsView.tsx` file itself (can be kept but will no longer be referenced)
- The `accounting_periods` table stays in the database (no destructive change) but is no longer surfaced in the UI

## What Gets Added

### 1. New Component: `src/components/accounting/AccountingReportsView.tsx`
A view with a "Generar Informe" button that opens a filter dialog. Contains:

- **Filter Dialog** with the following fields:
  - Date range (start/end date inputs)
  - Cost Center dropdown (General / Agricola / Industrial / Todos)
  - Account dropdown (from `chart_of_accounts`)
  - Project dropdown (from distinct `project_code` values in transactions)
  - CBS dropdown (from distinct `cbs_code` values in transactions)
  - Supplier/Name text input (searches `name` field)
- **Results Table** displayed after filters are applied, showing matching transactions with columns: Date, Account, Project, CBS, Cost Center, Name, Description, Currency, Amount, ITBIS
- **Export buttons**: Excel and PDF using the same `exceljs`/`jspdf` patterns already used in `Reports.tsx`

### 2. Update: `src/pages/Accounting.tsx`
- Remove `PeriodsView` import
- Replace the "periods" tab with a new "reports" tab pointing to `AccountingReportsView`
- Tab label: "Informes" (matching the existing sidebar terminology)

## Data Source
The report queries the `transactions` table directly (same as `Reports.tsx`), but scoped to the filters chosen in the dialog. This gives the accountant a focused, accounting-specific report tool without navigating away from the Accounting module.

## Technical Details

### AccountingReportsView Component Structure
- State: `filtersOpen` (dialog), `filters` (object with all filter values), `showResults` (boolean)
- Query: `useQuery` fetching from `transactions` with `.eq()` / `.gte()` / `.lte()` / `.ilike()` based on active filters
- Distinct values for dropdowns fetched via separate queries on `transactions` (project_code, cbs_code) and `chart_of_accounts`
- Export logic: reuse the same Excel/PDF patterns from `Reports.tsx` (ExcelJS workbook, jsPDF with autoTable)
- PDF header includes the active filters and totals by currency

### Filter Dialog Layout
- Two-column grid for date range
- Four-column grid for Cost Center, Account, Project, CBS
- Full-width row for Supplier name
- Footer: Cancel + "Ver Informe" (View Report) button

### Results View
- Summary bar showing transaction count and totals by currency
- Sortable table with the filtered data
- Export dropdown (Excel / PDF) in the toolbar
- "Modificar Filtros" button to reopen the dialog

## Files Changed
1. **New**: `src/components/accounting/AccountingReportsView.tsx` -- the full report component with dialog, table, and export
2. **Edit**: `src/pages/Accounting.tsx` -- swap PeriodsView for AccountingReportsView

