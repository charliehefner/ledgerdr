

## Make All Transaction Fields Editable Until Journal is Posted

### Problem
The Edit Transaction dialog currently has many fields locked as read-only (date, account, project, CBS, amount, currency, name, comments, direction). Users need to correct all fields until the associated journal entry is posted.

### Approach

**1. Check journal lock status**
When opening the edit dialog, query `journals` table for any entry linked via `transaction_source_id` with `status = 'posted'`. If posted → all fields read-only. If draft/pending/no journal → all fields editable.

**2. Make all fields editable in `EditTransactionDialog.tsx`**
Convert these currently read-only fields to editable:
- Transaction date
- Master account (dropdown)
- Project (dropdown)
- CBS code (dropdown)
- Currency (dropdown)
- Amount
- Name/vendor
- Comments
- Transaction direction
- Destination account (when direction = investment/payment)

Add state tracking (edited/original pattern already used) for all newly editable fields, and include them in the `updateTransaction` save payload.

**3. Expand `updateTransaction` in `src/lib/api.ts`**
Add support for updating all fields: `transaction_date`, `master_acct_code`, `project_code`, `cbs_code`, `currency`, `amount`, `name`, `comments`, `transaction_direction`, `destination_acct_code`, `cost_center`. Also resolve FK IDs (account_id, project_id, cbs_id) when those codes change.

**4. Visual indicator**
When journal is posted, show a banner: "Esta transacción tiene un asiento contable publicado y no puede ser editada." All fields become read-only with `bg-muted` styling.

### Files to Change

| File | Change |
|------|--------|
| `src/components/invoices/EditTransactionDialog.tsx` | Add journal-posted check; make all fields editable with conditional lock |
| `src/lib/api.ts` | Expand `updateTransaction` to accept all fields + resolve FK IDs |

