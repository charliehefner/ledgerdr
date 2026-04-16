

## Fix `linked_transaction_ids` Column Reference Error

### Problem
The `ap_ar_documents` table was refactored to use a junction table (`ap_ar_document_transactions`) instead of a `linked_transaction_ids UUID[]` column. However, `EditTransactionDialog.tsx` still references the old column in two places, causing errors when saving or voiding transactions.

### Changes

**`src/components/invoices/EditTransactionDialog.tsx`**

1. **Line ~296-299** — Replace the `.contains('linked_transaction_ids', ...)` lookup with a query against `ap_ar_document_transactions`:
   - Query `ap_ar_document_transactions` for rows where `transaction_id = transaction.id`
   - If found, use the `document_id` to get the AP/AR document

2. **Lines ~318-333** — Replace `linked_transaction_ids: [transaction.id]` in the insert payload:
   - Remove `linked_transaction_ids` from the `ap_ar_documents` insert
   - After inserting the AP/AR document, insert a row into `ap_ar_document_transactions` linking the new document to the transaction

**`src/components/settings/backup/schemaSql.ts`** (line 908)
- Remove `linked_transaction_ids UUID[]` from the backup schema to match the actual table

### Risk
- Low — fixes a broken code path; no schema changes needed since the junction table already exists

