

# Fix AP/AR Document Number and Contact Name

## Problem

1. **Document # is empty** for auto-created AP/AR records because `EditTransactionDialog` never populates `document_number`.
2. **Contact name is wrong** on backfilled records — all show "JORD DOMINICANA SRL" instead of the actual transaction contact (e.g., Charles Hefner).
3. **What should Document # be?** The user confirms it should be the **transaction number** (`legacy_id`), not the NCF/document field. This is the human-readable reference users see everywhere else.

## Changes

### 1. Data fix — SQL UPDATE via insert tool

Update all existing AP/AR documents to pull `contact_name` and `document_number` (as `legacy_id` cast to text) from the linked transaction:

```sql
UPDATE ap_ar_documents d
SET
  contact_name = t.name,
  document_number = t.legacy_id::text
FROM transactions t
WHERE d.linked_transaction_ids @> ARRAY[t.id]::uuid[]
  AND (d.document_number IS NULL OR d.contact_name = 'JORD DOMINICANA SRL');
```

### 2. EditTransactionDialog — set document_number on auto-creation

Add `document_number: transaction.legacy_id?.toString() || null` to the insert payload at line ~313.

### 3. TransactionForm — use legacy_id instead of NCF

In `TransactionForm.tsx` line ~336, change `document_number: form.document` to `document_number: data?.legacy_id?.toString() || null` (the legacy_id from the newly inserted transaction).

| File | Change |
|------|--------|
| Data (insert tool) | Fix contact_name + set document_number = legacy_id for existing records |
| `EditTransactionDialog.tsx` ~L313 | Add `document_number: transaction.legacy_id?.toString()` |
| `TransactionForm.tsx` ~L336 | Change from NCF `document` to `legacy_id` |

