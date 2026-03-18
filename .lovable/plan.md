

# Fix: Petty Cash Transactions Not Showing in Treasury

## Problem
When you create a transaction and select "Caja Chica Industria" as the payment method, the `pay_method` field stores the **UUID** of that petty cash bank_account. However, the Petty Cash view in Treasury queries for transactions where `pay_method = 'petty_cash'` (a literal string that no longer exists) OR `destination_acct_code IN (petty cash UUIDs)`.

Since the UUID stored in `pay_method` doesn't match the string `"petty_cash"`, your transactions are invisible in Treasury.

## Fix (1 file change)

**`src/components/accounting/PettyCashView.tsx`** — Update the transaction query filter (lines 113-136):

Replace the `or` filter with one that checks `pay_method IN (petty cash UUIDs)` instead of `pay_method = 'petty_cash'`:

```
pay_method.in.(uuid1,uuid2,...),destination_acct_code.in.(uuid1,uuid2,...)
```

This correctly matches transactions where the payment method is any petty cash fund UUID, plus transfers into petty cash via `destination_acct_code`.

## Reimbursement Workflow Answer

To reimburse a manager (remove funds from Caja Chica Industria):

1. **Record the expense**: Create a transaction with the expense account (e.g., 7200 Supplies), select **Caja Chica Industria** as the payment method. This debits the expense and credits the petty cash GL (1912).
2. **Pay the manager**: Create a **Transfer** from a bank account (e.g., BHD DOP) **to** Caja Chica Industria. This replenishes the fund and records the bank outflow.

Since Caja Chica Industria has a fixed amount of 0 (reimbursement model), the GL balance will go negative when expenses are recorded, then return to 0 when the bank transfer reimburses the fund. The Replenishment dialog (`Reponer Fondo`) automates step 2.

## Technical Detail
- One filter change in `PettyCashView.tsx` query (~3 lines)
- No database or migration changes needed

