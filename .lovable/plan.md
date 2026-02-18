

# Add Cost Center to Transactions

## Overview
Add a `cost_center` column to the `transactions` table with three fixed values: **General**, **Agricola** (Agricultural), **Industrial**. The dropdown will appear in the transaction form before the "Cuenta Principal" field, defaulting to "General" to minimize friction.

## Database Migration

Add a `cost_center` column to the `transactions` table:
- Type: `text NOT NULL DEFAULT 'general'`
- Constrained via CHECK to: `'general'`, `'agricultural'`, `'industrial'`
- All existing rows default to `'general'`

## Files to Change

### 1. New Migration
- `ALTER TABLE transactions ADD COLUMN cost_center text NOT NULL DEFAULT 'general'`
- CHECK constraint limiting to the three values

### 2. `src/lib/api.ts`
- Add `cost_center` to the `Transaction` interface (`'general' | 'agricultural' | 'industrial'`)
- Include `cost_center` in `createTransaction` insert
- Include `cost_center` in `fetchRecentTransactions` mapping

### 3. `src/components/transactions/TransactionForm.tsx`
- Add `cost_center: 'general'` to `initialFormState`
- Insert a "Centro de Costo" dropdown **before** the "Cuenta Principal" row (between the dates row and the account dropdowns row)
- Three options: General, Agricola, Industrial
- Pre-selected to "General"
- Pass `cost_center` to `createTransaction`

### 4. `src/components/transactions/columnConfig.ts`
- Add `costCenter` column to all three config arrays (`TRANSACTION_COLUMNS`, `REPORT_COLUMNS`, `DASHBOARD_COLUMNS`)
- Default visible in `REPORT_COLUMNS`, hidden in the other two

### 5. `src/components/transactions/RecentTransactions.tsx`
- Add cost center column rendering with colored badges:
  - General = gray badge
  - Agricola = green badge
  - Industrial = blue badge

### 6. `src/components/accounting/useJournalGeneration.ts`
- Add `cost_center` to the fetched transaction fields
- Append cost center label to journal description (e.g., "Compra diesel [Agricola]")

## User Experience
- The dropdown defaults to "General", so existing workflows require zero extra clicks
- Colored badges in tables make cost centers instantly scannable
- Reports can be filtered and grouped by cost center

