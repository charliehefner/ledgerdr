

# Fix AP/AR: Account Linkage, Transaction-Driven, Proper Separation

## Current Problems

1. **No GL account on documents** — PaymentDialog hardcodes `2100` (AP) and `1200` (AR). In reality, companies may have multiple AR/AP sub-accounts (e.g., 1201 Trade Receivables, 1202 Employee Receivables, 2101 Trade Payables, 2102 Accrued Payables).

2. **Manual "New Document" shouldn't be the primary workflow** — AP/AR documents should originate from transactions (purchase with `due_date` → payable; sale with `due_date` → receivable). The auto-creation from TransactionForm already does this, but:
   - It doesn't capture which AR/AP account is involved
   - The manual creation dialog also lacks account selection

3. **Separation** — Receivables and Payables already use separate tabs with `direction` filtering. But the accountant likely wants each document explicitly tied to a specific AR or AP account from the chart of accounts (not just a hardcoded 2100/1200).

## Plan

### 1. Database: Add `account_id` column to `ap_ar_documents`

```sql
ALTER TABLE public.ap_ar_documents
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES chart_of_accounts(id);
```

This links each document to a specific GL account (e.g., 1200 "Cuentas por Cobrar" or 2100 "Cuentas por Pagar").

### 2. Auto-creation from Transactions (TransactionForm.tsx)

When auto-creating AP/AR documents on transaction save (lines 306-330), look up the correct default account:
- **Payable** → find the first active `21xx` account (or allow the user to pick one in future)
- **Receivable** → find the first active `12xx` account
- Store the `account_id` on the document

### 3. Update "New Document" dialog (ApArDocumentList.tsx)

- Add a **required account selector** showing only relevant accounts:
  - For receivables: accounts starting with `12xx`
  - For payables: accounts starting with `21xx`
- Save the selected `account_id` on insert

### 4. Show account in the list view (ApArDocumentList.tsx)

- Join `chart_of_accounts` in the query to fetch account_code + name
- Add an "Account" column to the table

### 5. Use document's account in PaymentDialog

Replace hardcoded `2100`/`1200` lookup with the document's actual `account_id`. Pass `account_id` through the document prop so the payment journal debits/credits the correct GL account.

### Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Add `account_id` column |
| `TransactionForm.tsx` | Look up default AR/AP account_id during auto-creation |
| `ApArDocumentList.tsx` | Add account selector to dialog, account column to table, join in query |
| `PaymentDialog.tsx` | Use `document.account_id` instead of hardcoded account codes |

