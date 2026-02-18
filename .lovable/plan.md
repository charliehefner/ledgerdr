

# Consolidate Accounts into `chart_of_accounts` + Import Corporate CoA from Excel

## Summary

Import the full corporate Chart of Accounts (~350 accounts) from the uploaded Excel file into `chart_of_accounts`, add bilingual description columns, and retire the old `accounts` table from code. The existing 89 accounts are a subset of this corporate CoA, so they'll be covered by the import.

## Step 1: Database Migration -- Add bilingual columns to `chart_of_accounts`

Add two new columns:
- `english_description TEXT`
- `spanish_description TEXT`

These preserve the bilingual support that the `accounts` table currently provides.

## Step 2: Import the ~350 accounts from Excel

Insert all accounts from the Excel file into `chart_of_accounts` with:
- `account_code` = the Master account code (1010, 1018, etc.)
- `account_name` = Spanish description (primary display name)
- `english_description` = English description
- `spanish_description` = Spanish description
- `account_type` inferred from code prefix:
  - 1xxx = ASSET
  - 2xxx = LIABILITY (2081-2099 = EQUITY)
  - 3xxx = INCOME
  - 4xxx = EXPENSE
  - 5xxx-7xxx = EXPENSE
  - 8xxx = FINANCIAL (mapped to INCOME or EXPENSE as appropriate, or a catch-all)
- `allow_posting` = true for all (can be refined later)
- `currency` = DOP (default)
- No `parent_id` initially -- hierarchy can be set up later by grouping codes

Empty rows in the Excel (separators) will be skipped.

The special account `0000` (Internal Transfer) from the current `accounts` table is NOT in the Excel -- it will be added as an extra insert.

## Step 3: Update code references (2 files)

### `src/lib/api.ts` -- `fetchAccounts()`
Change query from `accounts` to `chart_of_accounts`, selecting `account_code as code, english_description, spanish_description`. The returned `Account` interface shape stays identical, so all downstream components (TransactionForm, Reports, etc.) need zero changes.

### `src/components/hr/ServicesView.tsx`
Same change -- query `chart_of_accounts` instead of `accounts`, mapping `account_code` to `code` and `spanish_description`.

## Step 4: Update `ChartOfAccountsView.tsx`

- Add bilingual display: show `english_description` or `spanish_description` based on language context using `getDescription()` pattern
- The existing tree, type filter, and CRUD dialog already work with `chart_of_accounts`
- Add `english_description` and `spanish_description` fields to the Add/Edit dialog

## Step 5: Keep `accounts` table (no drop)

The table stays in the database but is no longer queried. It can be removed in a future cleanup migration.

## Files Changed

1. **Database migration**: Add `english_description` and `spanish_description` columns to `chart_of_accounts`
2. **Data insert**: ~350 rows from Excel + the `0000` Internal Transfer account
3. **`src/lib/api.ts`**: Change `fetchAccounts()` to query `chart_of_accounts`
4. **`src/components/hr/ServicesView.tsx`**: Update inline account query
5. **`src/components/accounting/ChartOfAccountsView.tsx`**: Add bilingual display and update dialog fields

## Account Type Mapping

```text
Code Range    account_type
----------    ------------
1000-1999     ASSET
2000-2099     EQUITY
2100-2999     LIABILITY
3000-3999     INCOME
4000-4999     EXPENSE
5000-7999     EXPENSE
8000-8499     INCOME (financial)
8400-8499     EXPENSE (interest expense)
8800-8999     EQUITY/TAX
```

## What Stays the Same

- The `Account` interface in `api.ts` (`code`, `english_description`, `spanish_description`) -- no shape change
- All UI components that consume accounts (TransactionForm, Reports, autocompletes) -- they use the `Account` interface from `api.ts`
- The `getDescription()` helper continues to work as-is
- RLS policies on `chart_of_accounts` already cover all needed roles
