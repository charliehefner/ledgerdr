

# Replace Hardcoded Payment Method with Dynamic Treasury Accounts

## Problem
The **Payment Method** dropdown (for Purchase and Sale transactions) uses a hardcoded list of 8 options (`transfer_bdi`, `transfer_bhd`, `cash`, `petty_cash`, etc.). This doesn't reflect the actual treasury accounts registered in the system — for example, banks with both USD and DOP accounts are missing.

Meanwhile, the **Transfer** type already dynamically loads from the `bank_accounts` table (line 102-113), showing all active accounts with their currencies. The fix is to reuse this same data for the Payment Method dropdown.

## Plan

### 1. Replace hardcoded Payment Method select with dynamic bank_accounts (TransactionForm.tsx)

Replace the static `<SelectItem>` list (lines 916-924) with grouped options from the existing `bankAccounts` query, mirroring the transfer dropdown pattern:

- **Bancos** — `account_type === 'bank'` → show `account_name (currency)`
- **Tarjetas de Crédito** — `account_type === 'credit_card'`
- **Caja Chica** — `account_type === 'petty_cash'`
- **Crédito** — keep a static "credit" option for unpaid/on-account purchases

Each bank account's `id` will be stored as the `pay_method` value (same as transfers already do), replacing the old static codes like `transfer_bdi`.

### 2. Backwards compatibility
Existing transactions with old `pay_method` values (`transfer_bdi`, `cash`, etc.) will still display — we'll add a display-name resolver in `RecentTransactions` / `EditTransactionDialog` that checks if the value matches a `bank_accounts.id` (UUID) and looks up the name, otherwise falls back to the legacy label.

**Files changed**: `src/components/transactions/TransactionForm.tsx`, `src/components/transactions/RecentTransactions.tsx`, `src/components/invoices/EditTransactionDialog.tsx`

