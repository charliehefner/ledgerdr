

## Fix: Add Transfer From/To Fields to Edit Transaction Dialog

### Problem
The `EditTransactionDialog` lacks the bank-account-based From/To dropdowns that exist in `TransactionForm`. When editing a transaction to direction `payment` (Transfer), users see only a generic "Cuenta Destino" chart-of-accounts dropdown — no way to specify the source and destination treasury accounts or the cross-currency destination amount.

### Changes

**File: `src/components/invoices/EditTransactionDialog.tsx`**

1. **Add bank accounts query** — same query as TransactionForm fetching `bank_accounts` with `id, account_name, account_type, bank_name, chart_account_id, currency`

2. **Add head office accounts query** — fetch account 2160 from chart_of_accounts (for JORD AB as a transfer destination option)

3. **Add form state fields**: `transfer_from_account`, `transfer_to_account`, `transfer_dest_amount` to `formData` and `originalFormData`

4. **Initialize from existing transaction**: When editing a `payment` transaction, map `pay_method` → `transfer_from_account` and `destination_acct_code` → `transfer_to_account`, and `destination_amount` → `transfer_dest_amount`

5. **Replace the direction-conditional UI** (lines 438–467):
   - For `investment`: keep the current "Cuenta Destino" dropdown from chart_of_accounts
   - For `payment`: show From/To bank account dropdowns (grouped by type: Banco, Tarjeta, Caja Chica, plus head office option), matching TransactionForm's layout
   - Show cross-currency destination amount field when From/To currencies differ

6. **Update `handleSaveChanges`**: When saving a `payment` direction, map `transfer_from_account` → `pay_method` and `transfer_to_account` → `destination_acct_code`, and `transfer_dest_amount` → `destination_amount`

7. **Update `hasChanges`**: Include `transfer_from_account`, `transfer_to_account`, `transfer_dest_amount`

### No database changes needed
The `transactions` table already has `destination_amount`, `pay_method`, and `destination_acct_code` columns.

