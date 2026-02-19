

# Profit & Loss and Balance Sheet for Accounting Module

## Overview

Add two new financial statement views -- **Estado de Resultados (P&L)** and **Balance General (Balance Sheet)** -- to the Accounting module. Since no journals have been posted yet, these reports will pull directly from the `transactions` table (grouped by account), giving you immediately useful reports. They can later be switched to use posted journal data as the accounting workflow matures.

## Data Source Strategy

Since the journal posting workflow is not yet in active use (0 posted journals), the reports will aggregate non-void transactions by their `master_acct_code`, joining to `chart_of_accounts` to determine account type, hierarchy, and display names. This gives accurate results right away.

- **P&L** shows INCOME and EXPENSE accounts for a selected date range
- **Balance Sheet** shows ASSET, LIABILITY, and EQUITY accounts as of a selected date

## UI Design

Both reports will be added as **sub-tabs** (or a selector) within the existing "Informes" tab, keeping the current transaction-level report as well:

**Report Selector** (dropdown or toggle at the top):
1. Detalle de Transacciones (current view -- default)
2. Estado de Resultados (P&L)
3. Balance General (Balance Sheet)

Each financial statement will include:
- Date range filter (P&L) or "as of" date filter (Balance Sheet)
- Cost center filter (all / general / agricultural / industrial)
- Hierarchical account display using the chart of accounts tree structure
- Subtotals by account group (parent accounts)
- Grand totals (Net Income for P&L; Assets = Liabilities + Equity check for Balance Sheet)
- Export to Excel and PDF

### P&L Layout
```text
+----------------------------------------------+
| Estado de Resultados                         |
| Periodo: 01/01/2025 - 31/12/2025            |
+----------------------------------------------+
| Cuenta         | Descripcion      | Monto   |
+----------------------------------------------+
| INGRESOS                                     |
|   3010         | Ventas de Azucar | 500,000  |
|   3020         | Otros Ingresos   |  50,000  |
|                | Total Ingresos   | 550,000  |
+----------------------------------------------+
| GASTOS                                       |
|   4010         | Salarios         | 200,000  |
|   5010         | Combustible      |  80,000  |
|                | Total Gastos     | 280,000  |
+----------------------------------------------+
|                | UTILIDAD NETA    | 270,000  |
+----------------------------------------------+
```

### Balance Sheet Layout
```text
+----------------------------------------------+
| Balance General                              |
| Al: 31/12/2025                               |
+----------------------------------------------+
| ACTIVOS                                      |
|   1100         | Efectivo         | 300,000  |
|   1200         | Cuentas x Cobrar | 150,000  |
|                | Total Activos    | 450,000  |
+----------------------------------------------+
| PASIVOS                                      |
|   2110         | Cuentas x Pagar  | 100,000  |
|                | Total Pasivos    | 100,000  |
+----------------------------------------------+
| PATRIMONIO                                   |
|   2081         | Capital Social   |  80,000  |
|                | Utilidad Periodo | 270,000  |
|                | Total Patrimonio | 350,000  |
+----------------------------------------------+
| PASIVOS + PATRIMONIO                | 450,000|
+----------------------------------------------+
```

## Technical Plan

### 1. New Component: `ProfitLossView.tsx`
- Date range picker (start/end) and cost center filter
- Queries `transactions` table filtered by date range, is_void=false, cost_center
- Joins to `chart_of_accounts` to get account_type, account hierarchy, and descriptions
- Groups totals by account_code for INCOME and EXPENSE types
- Renders hierarchical tree with subtotals per parent group
- Shows Net Income (Total Income - Total Expenses) at bottom
- Excel and PDF export following existing patterns

### 2. New Component: `BalanceSheetView.tsx`
- "As of" date picker and cost center filter
- Queries all non-void transactions up to the selected date
- Groups by account_code for ASSET, LIABILITY, and EQUITY types
- For Balance Sheet, also calculates retained earnings (net income from INCOME/EXPENSE accounts) and includes it in the Equity section
- Renders hierarchical tree with subtotals
- Shows balancing check (Assets = Liabilities + Equity)
- Excel and PDF export

### 3. Update `AccountingReportsView.tsx`
- Add a report-type selector (dropdown or segmented control) at the top
- "Detalle" shows the existing transaction table view
- "Estado de Resultados" renders `ProfitLossView`
- "Balance General" renders `BalanceSheetView`

### 4. Translation Keys
- Add Spanish/English labels for all new UI elements to the language context

### Key Technical Details
- Account classification uses the `account_type` field from `chart_of_accounts` (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
- Hierarchical display uses `parent_id` relationships already in the chart
- For purchases (`transaction_direction = 'purchase'`), amounts are debits; for sales, amounts are credits
- Currency handling: separate columns/totals for DOP and USD transactions
- Both reports respect the bilingual `getDescription()` pattern

