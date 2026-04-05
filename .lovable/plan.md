

# Intercompany Workflow — Implementation Plan

This covers Steps 4-7 from the original plan: shared bank accounts, automated intercompany journals, the intercompany dashboard, and elimination in consolidated reports. Everything is opt-in — entities without a group are completely unaffected.

## Step 1 — Shared Bank Accounts Toggle

**BankAccountsList.tsx**: Add an `is_shared` switch to the bank account create/edit dialog, visible only when the current entity belongs to a group. The type definition and form state gain the `is_shared` field. Save writes to the existing `is_shared` column added in the previous migration.

**TransactionForm.tsx**: When the selected entity belongs to a group, the payment method query expands to include shared bank accounts from sibling entities (same `entity_group_id`, `is_shared = true`). Each sibling account is labeled with its owner entity code (e.g. "BHD — Industrial"). When a sibling account is selected, show an Alert banner: "This payment will generate intercompany entries."

Requires: a small helper query to fetch the current entity's `entity_group_id` and sibling entity IDs.

## Step 2 — Intercompany Journal Generation

**generate-journals edge function**: After the existing bank account lookup, add intercompany detection logic:

1. For each transaction, check if `pay_method` resolves to a bank account owned by a different entity in the same group (`is_shared = true`).
2. If yes, look up `intercompany_account_config` for the group to get the receivable (1570) and payable (2470) account IDs.
3. Instead of the normal journal, generate **two journals**:
   - **Payer entity journal**: DR 1570 (Due from beneficiary) / CR Bank
   - **Beneficiary entity journal**: DR Expense + ITBIS / CR 2470 (Due to payer)
4. Insert a row into `intercompany_transactions` linking both journals.
5. Non-intercompany transactions continue through the existing path unchanged.

The detection is a simple comparison: `bankAccount.entity_id !== transaction.entity_id`. If no `intercompany_account_config` exists for the group, skip intercompany logic and log a warning in `skipped[]`.

## Step 3 — Intercompany Dashboard

**New file: IntercompanyView.tsx** — a new tab under Accounting (only visible when the current entity belongs to a group).

Content:
- **Net Balances table**: Query `intercompany_transactions` grouped by entity pair, showing net position (Entity A owes Entity B $X).
- **Transaction list**: Filterable table of all intercompany transactions with date, amount, description, and links to both journals.
- **Settle button**: Creates a settlement journal that zeros out a pair's balance — DR 2470 / CR 1570 in both entities — and records a settlement `intercompany_transaction`.

**Accounting.tsx**: Conditionally add the "Intercompany" tab (with `ArrowLeftRight` icon) when the user's entity has a group.

## Step 4 — Consolidated Report Elimination Toggle

**ProfitLossView.tsx** and **BalanceSheetView.tsx**: When in consolidated/All Entities mode and the entity belongs to a group:

- Add an "Eliminate Intercompany" Switch toggle (default off).
- When toggled on, subtract all 1570/2470 balances from the report totals by querying `intercompany_transactions` for unsettled amounts within the group.
- The elimination is display-only — no journals are created.

**TrialBalanceView.tsx**: Same toggle, same logic.

## What Does NOT Change

- Entities without a group: zero impact, no intercompany UI visible.
- Existing journal generation for non-shared accounts: unchanged.
- Chart of accounts: no new accounts needed (1570 and 2470 already exist).
- All other modules: unaffected.

## Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/BankAccountsList.tsx` | Add `is_shared` toggle to form dialog |
| `src/components/transactions/TransactionForm.tsx` | Fetch sibling shared accounts, show intercompany banner |
| `supabase/functions/generate-journals/index.ts` | Add intercompany detection and paired journal generation |
| `src/components/accounting/IntercompanyView.tsx` | New — dashboard with balances, transactions, settle |
| `src/pages/Accounting.tsx` | Add conditional Intercompany tab |
| `src/components/accounting/ProfitLossView.tsx` | Add elimination toggle |
| `src/components/accounting/BalanceSheetView.tsx` | Add elimination toggle |
| `src/components/accounting/TrialBalanceView.tsx` | Add elimination toggle |
| `src/i18n/en.ts` and `src/i18n/es.ts` | Add intercompany-related strings |

