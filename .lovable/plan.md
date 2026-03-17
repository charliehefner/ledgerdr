

# Fix: Backfill Credit Transactions into AP/AR and Handle Edits

## Problem

1. **No AP/AR documents exist** — the table is empty despite 7 credit transactions
2. The auto-creation logic only fires on **new** transaction inserts via `TransactionForm`
3. The `EditTransactionDialog` can now set `due_date`, but doesn't create an AP/AR document either
4. The most recent loan transaction (DOP 130,000) has `due_date: 2026-03-20` set via edit, but still no AP/AR doc

## Fix — Two Parts

### Part 1: SQL Migration to Backfill Existing Credit Transactions

Run a one-time INSERT into `ap_ar_documents` for all `pay_method = 'credit'` transactions that don't already have a linked AP/AR document:

- Direction: `purchase` → `payable`, `sale` → `receivable`
- `due_date`: use transaction's `due_date` if set, otherwise `transaction_date + 30 days`
- `total_amount` / `balance_remaining`: transaction `amount`
- `amount_paid`: 0, `status`: `open`
- `linked_transaction_ids`: array containing the transaction ID
- Look up default GL account (21xx for payable, 12xx for receivable)

### Part 2: EditTransactionDialog — Create AP/AR on Due Date or Credit Changes

In `EditTransactionDialog`, after saving the transaction, if:
- `pay_method === 'credit'` OR `due_date` is now set
- AND no AP/AR document is already linked to this transaction

Then auto-create an AP/AR document (same logic as TransactionForm).

**Files changed:**
| Item | Type |
|------|------|
| SQL migration (backfill) | Database migration |
| `EditTransactionDialog.tsx` | Code edit — add AP/AR creation on save |

