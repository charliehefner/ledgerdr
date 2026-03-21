

## Investigation Results

**Root cause**: The manual document creation in `ApArDocumentList.tsx` (the "Add Document" form) does NOT explicitly set `status` or `amount_paid` when inserting into `ap_ar_documents`. It relies entirely on database column defaults. While the current default is `'open'`, document 361 was likely created during a window when the code or schema behaved differently, or via a direct insert that omitted the field.

The three insert paths are:
1. **TransactionForm.tsx** — explicitly sets `status: 'open'`, `amount_paid: 0`, `balance_remaining` ✅
2. **EditTransactionDialog.tsx** — explicitly sets `status: 'open'`, `amount_paid: 0` ✅
3. **ApArDocumentList.tsx** — does NOT set `status`, `amount_paid`, or `balance_remaining` ⚠️

Path #3 is the only one missing explicit values, making it vulnerable to default changes or edge cases.

---

## Plan

### Step 1: Fix existing data
Update document 361's status from `'pending'` to `'open'` using the database insert tool (UPDATE query).

### Step 2: Make manual creation defensive
In `ApArDocumentList.tsx`, add explicit values to the insert call:
- `status: 'open'`
- `amount_paid: 0`

This ensures the manual creation path matches the behavior of the other two insert paths.

### Step 3: Add a database CHECK constraint
Add a migration with a CHECK constraint on `ap_ar_documents.status` to only allow the four valid values: `open`, `partial`, `paid`, `void`. This prevents any future code from inserting an invalid status value at the database level.

```sql
ALTER TABLE public.ap_ar_documents
ADD CONSTRAINT ap_ar_documents_status_check
CHECK (status IN ('open', 'partial', 'paid', 'void'));
```

### Files changed
- `src/components/accounting/ApArDocumentList.tsx` — add explicit `status` and `amount_paid` to insert
- New migration — CHECK constraint on status column
- Data fix — UPDATE document 361 status to `'open'`

