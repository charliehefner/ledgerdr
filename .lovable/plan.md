
# Reports Section Implementation Plan

## Overview
Build a `/reports` route with 6 report tabs, entity-aware filtering, date pickers, and Excel/PDF exports.

## Phase 1: Page structure & shared components
- Create `src/pages/Reports.tsx` with `TabbedPageLayout`
- Add `/reports` route, nav link (visible to admin, management, accountant only)
- Add date range pickers (start/end) and entity filter at the top
- Entity filter uses existing `useEntity()` context

## Phase 2: Tab components (6 files)
Each tab gets its own component file under `src/components/reports/`:

1. **ProfitLossReport.tsx** — calls `get_profit_loss` RPC, groups by INCOME/EXPENSE, footer totals, side-by-side entity columns when "All Entities"
2. **BalanceSheetReport.tsx** — calls `get_balance_sheet` RPC, groups by ASSET/LIABILITY/EQUITY, single as-of date picker
3. **CostPerFieldReport.tsx** — calls `get_cost_per_field` RPC, table + recharts bar chart
4. **AgingReport.tsx** — queries `v_ap_ar_aging` view, groups by aging bucket, summary bar
5. **TrialBalanceReport.tsx** — queries `v_trial_balance` view, debit/credit balance check
6. **PayrollSummaryReport.tsx** — queries `v_payroll_summary` view joined with date range

## Phase 3: Shared behaviors per tab
- Loading skeleton
- Empty state message
- Error state with retry
- Excel export (reuse existing `exceljs` pattern)
- PDF export (reuse existing `jspdf` + `jspdf-autotable` pattern)
- DOP currency formatting via `formatMoney` or `Intl.NumberFormat`

## Phase 4: Nav visibility
- Add Reports link to sidebar, gated to admin/management/accountant roles
- Hide from supervisor/viewer/driver

## Files to create (~8 files)
- `src/pages/Reports.tsx`
- `src/components/reports/ProfitLossReport.tsx`
- `src/components/reports/BalanceSheetReport.tsx`
- `src/components/reports/CostPerFieldReport.tsx`
- `src/components/reports/AgingReport.tsx`
- `src/components/reports/TrialBalanceReport.tsx`
- `src/components/reports/PayrollSummaryReport.tsx`
- `src/components/reports/ReportExports.tsx` (shared export utilities)

## Files to modify (~2 files)
- `src/App.tsx` — add route
- `src/components/layout/Sidebar.tsx` — add nav link with role gate
