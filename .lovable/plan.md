## Findings

- Your BDI DOP → BHD DOP transfers were created in `transactions` as internal transfers, including the duplicate rows `664` and `665`.
- The Internal Transfers list query currently does **not exclude voided rows**, so it can behave inconsistently after annulment.
- Internal transfers are being inserted without any journal tied to them, so the cash movement is not actually reflected in accounting balances.
- The normal Recent Transactions list currently includes internal transfer rows, which is why you saw them there instead of treating them as treasury-only movements.
- Annulment uses the generic transaction dialog and `legacy_id`; it partially worked for row `664`, but internal transfers need their own safe void path because they are different from normal purchase/sale transactions.

## Plan

1. **Database/RPC fix for internal transfers**
   - Add/replace a `generate_internal_transfer_journal(transaction_id)` database function.
   - It will resolve the origin and destination `bank_accounts.chart_account_id` values.
   - For same-currency transfers like BDI DOP → BHD DOP, it will create a balanced journal:
     - Debit destination bank account.
     - Credit origin bank account.
   - For cross-currency transfers, it will use `destination_amount` for the destination debit and keep the source amount/currency fields intact.
   - It will carry `entity_id` explicitly from the transaction to the journal.

2. **Create transfers through a dedicated internal-transfer RPC**
   - Add `create_internal_transfer(...)` instead of using the generic `create_transaction_with_ap_ar` RPC.
   - The RPC will validate:
     - origin and destination are different,
     - both bank accounts exist,
     - amount is positive,
     - cross-currency destination amount is present,
     - user has permission for the target entity.
   - It will insert the transaction and generate its journal in one backend transaction, so the UI cannot show “saved” while accounting remains unchanged.

3. **Add safe annulment for internal transfers**
   - Add `void_internal_transfer(transaction_id, reason)`.
   - It will mark the transfer as voided and, if a posted journal exists, rely on the existing reversal trigger; if only an unposted journal exists, remove it safely.
   - This avoids using the generic normal-transaction annul flow for treasury transfers.

4. **Fix list visibility**
   - Internal Transfers recent list: show only `is_internal = true`, non-void transfers, destination not credit card, and selected `entity_id`.
   - Normal Recent Transactions list: exclude internal transfers by default, so treasury transfers do not appear twice as normal purchases/payments.
   - After saving or voiding, invalidate both recent transaction queries so the preview refreshes immediately.

5. **Frontend changes**
   - Update `InternalTransfersView.tsx` to call `create_internal_transfer` and show a clear success/error toast.
   - Add an annul action in the Internal Transfers list for unposted or reversible transfers.
   - Keep the edit dialog using `update_internal_transfer`, but ensure it regenerates the internal transfer journal after edits.

6. **Audit current bad rows**
   - Leave row `664` voided.
   - Confirm row `665` is the valid transfer, generate its missing journal, and verify it appears in Internal Transfers but no longer appears in normal Recent Transactions.

## Technical details

- Database changes will be implemented as a migration with new/replaced backend functions only; no table schema changes are required.
- Frontend changes are limited to:
  - `src/components/accounting/InternalTransfersView.tsx`
  - `src/lib/api.ts` or local query filtering used by Recent Transactions
  - possibly `src/components/transactions/RecentTransactions.tsx` only if needed for cache/query keys.
- I will validate by querying the affected transaction rows and their journals after the fix.