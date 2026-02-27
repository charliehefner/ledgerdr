

## Plan: Power BI Excel Export for Accounting Data

### Overview

Add an "Exportar Power BI" button to the Accounting Reports tab that exports four flat, denormalized Excel worksheets in a single `.xlsx` file -- optimized for Power BI import.

### Datasets (one worksheet each)

1. **ChartOfAccounts** -- `account_code`, `account_name`, `account_type`, `currency`, `allow_posting`, `parent_code`, `english_description`, `spanish_description`
2. **JournalLines** -- Denormalized: `journal_number`, `journal_type`, `journal_date`, `currency`, `exchange_rate`, `posted`, `description`, `account_code`, `account_name`, `project_code`, `cbs_code`, `debit`, `credit`, `debit_base`, `credit_base` (base = amount × exchange_rate)
3. **GeneralLedger** -- Direct from the `general_ledger` view: `journal_date`, `journal_number`, `account_code`, `account_name`, `description`, `debit`, `credit`, `debit_base`, `credit_base`, `running_balance_base`
4. **Transactions** -- Flat transaction export: `legacy_id`, `transaction_date`, `master_acct_code`, `project_code`, `cbs_code`, `cost_center`, `description`, `name`, `currency`, `amount`, `itbis`, `pay_method`, `document`, `rnc`

### Implementation

**New file: `src/components/accounting/PowerBIExportButton.tsx`**
- Button with BarChart3 icon labeled "Exportar Power BI"
- On click: fetches all four datasets in parallel, builds a multi-sheet ExcelJS workbook with proper column types (dates as dates, numbers as numbers), uses the existing `saveFileWithPicker` pattern from `useExport.ts`
- Shows loading spinner during export
- Handles the 1000-row limit by paginating queries for journals/transactions

**Modified: `src/components/accounting/AccountingReportsView.tsx`**
- Import and render `PowerBIExportButton` in the toolbar area (visible regardless of report type selected)

### Technical Details
- All numeric columns use Excel number format so Power BI auto-detects types
- Date columns stored as proper Excel dates
- `debit_base`/`credit_base` calculated client-side as `amount × exchange_rate` for journal lines
- Filename: `PowerBI_Accounting_YYYY-MM-DD.xlsx`
- No database changes needed

### Files
- `src/components/accounting/PowerBIExportButton.tsx` (new)
- `src/components/accounting/AccountingReportsView.tsx` (add button)

