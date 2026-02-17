

# Accounting Page — Phase 1

## Summary

Create a new `/accounting` route with a tabbed layout containing four functional tabs. The "Activos Fijos" tab moves from the Equipment page to here. Chart of Accounts and Periods use the existing database tables directly -- no placeholders.

## Tab Layout

1. **Plan de Cuentas** (Chart of Accounts) -- Browse/manage the `chart_of_accounts` table
2. **Periodos** (Accounting Periods) -- Browse/manage the `accounting_periods` table
3. **Activos Fijos** (Fixed Assets) -- The existing `FixedAssetsView` component, relocated
4. **Diario** (Journal) -- Browse the `journals` + `journal_lines` tables (read-only for now)

## Changes

### 1. New route and page

- Add `"accounting"` to the `Section` type in `src/lib/permissions.ts`
- Add permission entries: admin, management, accountant can access; viewer can read
- Add `/accounting` route in `src/App.tsx`
- Add sidebar nav item with a `BookOpen` (or `Calculator`) icon
- Create `src/pages/Accounting.tsx` using `TabbedPageLayout`

### 2. Chart of Accounts tab (`src/components/accounting/ChartOfAccountsView.tsx`)

- Queries `chart_of_accounts` table (currently 0 rows, but ready for the SQL import)
- Table columns: account_code, account_name, account_type, allow_posting, currency
- Hierarchical display using `parent_id` (indent child accounts)
- Filter by account_type (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
- Add/Edit dialog for individual accounts
- The table is already there with RLS policies in place

### 3. Accounting Periods tab (`src/components/accounting/PeriodsView.tsx`)

- Queries `accounting_periods` table
- Table columns: period_name (or start/end formatted), start_date, end_date, status (open/closed)
- Button to create new period
- Button to close a period (sets status)
- Simple CRUD -- the table structure already exists

### 4. Fixed Assets tab

- Move the existing `FixedAssetsView` and `FixedAssetDialog` from `src/components/equipment/` to `src/components/accounting/` (or just import from current location)
- Remove the "Activos Fijos" tab from `src/pages/Equipment.tsx`, reverting it to just Tractors + Implements

### 5. Journal tab (`src/components/accounting/JournalView.tsx`)

- Queries `journals` joined with `journal_lines`
- Table columns: journal_number, journal_date, description, currency, posted status
- Expandable rows to show debit/credit lines
- Read-only for now (journal entry creation is a follow-up)

### 6. No database changes needed

All tables (`chart_of_accounts`, `accounting_periods`, `journals`, `journal_lines`) already exist with proper RLS policies. No migrations required.

## Technical Notes

- The `chart_of_accounts` table currently has 0 rows. The CoA view will show an empty state with a message like "No hay cuentas. Importe su plan de cuentas." The SQL import that was discussed previously can populate it.
- `accounting_periods` is also empty -- the Periods view will let users create their first period.
- Permissions: `accounting` section accessible to admin, management, accountant (write), and viewer (read-only), matching the RLS policies already on the tables.
- Equipment page reverts to its original 2-tab layout (Tractors, Implements).
