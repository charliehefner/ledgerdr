## Goal
Eliminate the duplicate Profit & Loss, Balance Sheet, Trial Balance, and Aging reports between **Analytics** and **Accounting**. Make **Accounting** the single source of truth (richer feature set: dual currency, BAS-prefix categorization, parent/child grouping, period comparison, FX rate). Preserve the unique multi-entity consolidation feature currently only in Analytics by adding it to the Accounting views.

## Why this matters
- **Risk of mismatched numbers**: Accounting views read `account_balances_from_journals` RPC; Analytics tabs use `get_profit_loss`, `get_balance_sheet`, and `v_trial_balance`. Different filters/sources can yield different totals for the same date range — accountants will lose trust.
- **Double maintenance burden** for sign conventions, FX, period locking, etc.
- **User confusion**: two "Estado de Resultados" entries with different layouts.

---

## Changes

### 1. `src/pages/AnalyticsReports.tsx` — remove duplicate tabs
Remove these tabs (and their imports): **Estado de Resultados (`pnl`), Balance General (`balance-sheet`), Aging CxP/CxC (`aging`), Balanza Comprobación (`trial-balance`)**.

Analytics keeps only the genuinely analytical tabs:
- Costo por Campo (`cost-field`)
- Resumen Nómina (`payroll`)
- Consumo Combustible (`fuel`)

Default `activeTab` becomes `"cost-field"`.

The page subtitle stays; consider renaming to **"Analítica Operacional"** since financial statements move out.

### 2. Delete the now-orphaned components
- `src/components/analytics/ProfitLossTab.tsx`
- `src/components/analytics/BalanceSheetTab.tsx`
- `src/components/analytics/TrialBalanceTab.tsx`
- `src/components/analytics/AgingReportTab.tsx`

### 3. Port multi-entity consolidation to Accounting views
This is the only feature Accounting lacks today. Add it to:
- `src/components/accounting/ProfitLossView.tsx`
- `src/components/accounting/BalanceSheetView.tsx`
- `src/components/accounting/TrialBalanceView.tsx`
- `src/components/accounting/AgingReportView.tsx`

**Approach**:
- Read `selectedEntityId` and `isAllEntities` from `useEntity()`.
- When `isAllEntities` is true (global admin in "All Entities" mode), fetch balances per entity and render an extra **side-by-side column per entity + Consolidated column** (mirroring the pattern already in `ProfitLossTab` / `BalanceSheetTab`).
- When a single entity is selected, behavior is unchanged.
- The existing `account_balances_from_journals` RPC needs to accept an optional `p_entity_id` parameter — verify it does; if not, add an overloaded version via migration. (Will check during implementation; likely a one-line filter add.)

### 4. Verify the Accounting `AccountingReportsView` card grid is complete
The landing card grid in Accounting → Reportes already exposes: P&L, Balance Sheet, Trial Balance, Cash Flow, Aging, Transaction Detail. ✅ No change needed — users already have one clear entry point.

### 5. i18n
Remove unused translation keys only if confirmed unreferenced after the deletions; otherwise leave to avoid breaking other usages.

---

## Out of scope
- No changes to Cash Flow (already only in Accounting).
- No changes to the `get_profit_loss` / `get_balance_sheet` RPCs themselves — they may still be used by edge functions or other reports; leave them.
- No changes to financial calculation logic in the Accounting views — they remain authoritative.

## Verification after implementation
1. Analytics page loads with 3 tabs (Costo por Campo, Nómina, Combustible). Default tab renders.
2. Accounting → Reportes → Estado de Resultados: when global admin selects "All Entities", side-by-side columns appear per entity. When a single entity is selected, view is unchanged from today.
3. Same for Balance Sheet, Trial Balance, Aging.
4. No dead imports, no broken routes.