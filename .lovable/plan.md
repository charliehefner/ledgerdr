
Goal: allow editing the due date on existing A/P and A/R documents after creation, so a credit transaction like 442 can be extended later without changing the original transaction unless explicitly desired.

What I found
- Credit transactions already auto-create AP/AR docs with a due date:
  - `TransactionForm.tsx` defaults credit-without-date to `+30 days`
  - `EditTransactionDialog.tsx` also syncs due dates into linked AP/AR docs
- The AP/AR list shows due dates but has no edit action for them:
  - `src/components/accounting/ApArDocumentList.tsx`
- Current row actions only allow:
  - register payment
  - apply advance
- There is no dedicated AP/AR edit dialog right now.
- Permissions already exist for write access to the AP/AR section, so this should stay limited to users who can write there.

Implementation plan
1. Add an “Edit due date” action in AP/AR
- Add a small row action in `ApArDocumentList.tsx` for open/partial documents
- Make it available for both payables and receivables
- Hide/disable it for void/paid documents

2. Add a focused due-date edit dialog
- Create a lightweight dialog in `ApArDocumentList.tsx` or a small dedicated component
- Show:
  - contact/document number
  - document date
  - current due date
  - new due date input
- Include clear option to remove the due date if needed

3. Update the AP/AR document directly
- On save, update `ap_ar_documents.due_date`
- Invalidate the AP/AR queries so:
  - the table refreshes
  - aging buckets refresh automatically
- Keep this scoped to the AP/AR document only, since extensions are usually a sub-ledger/business change, not a rewrite of the original source transaction

4. Add safe validation
- Prevent editing paid or void docs
- Validate that due date is not before document date unless you want to allow that; default recommendation is to block earlier dates
- Show clear success/error toasts

5. Keep transaction synchronization intentional
- Do not automatically rewrite `transactions.due_date` for existing items in this first pass
- Reason: the AP/AR due date is the operative collection/payment term after renegotiation, while the original transaction can remain historical
- If needed later, we can add a separate “also sync back to source transaction” behavior

Technical details
- Main file to update:
  - `src/components/accounting/ApArDocumentList.tsx`
- Existing data flow already supports due dates in:
  - `transactions.due_date`
  - `ap_ar_documents.due_date`
- No schema change is needed; this is a UI + update-flow enhancement only.
- Recommended UX:
```text
AP/AR row
[Apply Advance] [Register Payment] [Edit Due Date]

Edit Due Date dialog
- Document: 442
- Contact: ...
- Document date: ...
- Due date: [datepicker]
- [Clear date]
- [Cancel] [Save]
```

Expected result
- For transaction 442’s payable, you’ll be able to open A/P, edit the due date, and save the extension directly.
- Aging and balances will immediately reflect the new due date.
