## Goal

In **Treasury → Internal Transfers**, the "Recent Transfers" table is read-only, so wrong dates/amounts (e.g. the row dated 2026-05-29 in your data) can't be corrected. Add an **Edit** action on each row, restricted to transfers whose journal hasn't been posted yet.

## Changes

### 1. `InternalTransfersView.tsx` — recent transfers table

- Add an "Acciones" column with a pencil **Edit** button per row.
- Disable the button (with tooltip "Asiento ya posteado") when the transfer's journal is posted.
- Fetch posted status alongside the recent list: include `journal_entries!inner(posted)` (or a small follow-up query keyed by `transaction_id`) so the UI can decide.
- Clicking Edit opens a new `EditInternalTransferDialog` pre-filled with the row.

### 2. New `EditInternalTransferDialog.tsx`

Same fields as the create form: date, origin account, destination account, origin amount, destination amount (when cross-currency), description. Validations identical to the create form (different accounts, positive amount, dest_amount required for cross-currency).

On Save:
- Call a new RPC `update_internal_transfer(p_transaction_id, p_date, p_from_account, p_to_account, p_amount, p_destination_amount, p_description)`.
- On success: toast, close, invalidate `recent-internal-transfers` and `existingTransactions` queries.

### 3. New SQL RPC `update_internal_transfer`

- Loads the transaction; verifies `is_internal = true` and `transaction_direction IN ('payment','investment')`.
- Verifies no posted journal entry exists for this transaction (`SELECT 1 FROM journal_entries WHERE transaction_id = p_transaction_id AND posted = true`); if any, raise "No se puede editar: asiento ya posteado".
- Verifies the period isn't locked for the new date (reuse existing period-lock check pattern).
- Deletes existing **unposted** journal entries for this transaction.
- Updates `transactions` row with the new values (date, pay_method = from, destination_acct_code = to, amount, destination_amount, description, currency derived from the from-account).
- Re-invokes the same internal-transfer journal generation logic used by `create_transaction_with_ap_ar` for `master_acct_code = '0000'` so debits/credits to 0000 and the bank accounts are regenerated correctly (including FX gain/loss when cross-currency).
- Wrapped in a single transaction; `SECURITY DEFINER` with `SET search_path = public`.

### 4. Permissions

- RPC: grant `EXECUTE` to `authenticated`.
- Inside the RPC, check the caller has Admin/Mgmt/Accountant role via existing `has_role` helper; otherwise raise insufficient privileges (matches editability rules elsewhere).

## Out of scope

- Posted transfers remain immutable (per your choice). To fix one of those, you'd unpost the journal first or create a reversing transfer — same rule as elsewhere in the app.
- No delete button is added.

## Technical notes

```text
Recent Transfers row
  ├─ Date | From | To | Amount | Description
  └─ [✏ Edit] ──► EditInternalTransferDialog ──► rpc.update_internal_transfer
                                                       │
                                                       ├─ guard: unposted + period open + role
                                                       ├─ delete unposted journal lines
                                                       ├─ UPDATE transactions
                                                       └─ regenerate 0000 + bank journal lines
```
