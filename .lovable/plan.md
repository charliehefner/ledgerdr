# Allow Office Role to Attach Documents to Transactions

## Problem

Users with the `office` role can create and edit transactions, but the paperclip attachment button fails silently when they try to upload an NCF, receipt, or quote. This is because two separate Row-Level Security layers exclude `office`:

1. **`public.transaction_attachments` table** — policies only grant access to `admin`, `management`, `accountant`, and `viewer` (read-only). `office` cannot insert/update rows.
2. **`storage.objects` for the `transaction-attachments` bucket** — INSERT and SELECT policies only allow `admin`, `management`, `accountant` (and `supervisor` for SELECT). `office` cannot upload or view files.

The frontend (`MultiAttachmentCell`) has no role gating, so this is purely a database-policy fix.

## Fix

Single migration that adds `office` to all relevant policies. No frontend changes needed.

### 1. `public.transaction_attachments`

Add a new policy:

```sql
CREATE POLICY "Office full access" ON public.transaction_attachments
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = transaction_attachments.transaction_id
    AND has_role_for_entity(auth.uid(), 'office'::app_role, t.entity_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = transaction_attachments.transaction_id
    AND has_role_for_entity(auth.uid(), 'office'::app_role, t.entity_id)
));
```

### 2. `storage.objects` for `transaction-attachments` bucket

Drop and recreate the upload + view policies to include `office`:

- **"Authorized users can upload transaction attachments"** (INSERT): add `has_role(auth.uid(), 'office')`
- **"Authorized roles can view transaction attachments"** (SELECT): add `has_role(auth.uid(), 'office')`

Delete and update policies stay admin-only (matches the existing pattern where attachment deletion is restricted).

## Scope (intentionally narrow)

- Only the `transaction-attachments` bucket and `transaction_attachments` table are touched.
- Office's existing permissions on `transactions` (already present in `src/lib/permissions.ts`) are unchanged.
- No code changes to `MultiAttachmentCell.tsx`, `TransactionForm.tsx`, or `lib/permissions.ts` are required — the UI already exposes the button to office users; only the backend policies were blocking it.

## Verification after deploy

1. Log in as an `office` user.
2. Open Transactions → click paperclip on any row → upload a PDF/image.
3. Confirm: file uploads, appears in the dropdown, and the signed-URL preview opens.
