# Refactor `register_service_partial_payment` to use central AP routines

## Goal

Eliminate the class of bug where the service-payment RPC hand-rolls AP/GL logic and silently posts to the wrong account. Route everything through the project's canonical AP routines so the rules are enforced in one place.

## Current behavior (problematic)

The RPC inserts an `ap_ar_documents` row directly without posting a bill journal, then writes a single `transactions` row coded against `2101`. The expense account stored on `service_entries.master_acct_code` is not propagated to the GL. My earlier patch worked around this by stamping the service's expense code onto the transaction — that fixed the symptom but not the architectural problem.

## Proposed behavior

Replace the hand-rolled AP+transaction inserts with two calls to the central routines:

1. **Bill creation** — when `service.ap_document_id IS NULL`, call `create_ap_ar_document(...)` with:
   - `p_account_id` = chart id of `2101` (AP control)
   - `p_offset_account_id` = chart id of `service_entries.master_acct_code` (expense)
   - `p_post_journal = true`
   This posts a balanced bill journal: **DR expense / CR 2101**.

2. **Payment** — call `apply_ap_ar_payment(p_document_id, p_payment_date, p_amount, p_bank_account_id, p_user_id)`.
   This posts: **DR 2101 / CR Bank**, creates the `transactions` row, the `ap_ar_payments` row, and handles FX/realized-gain logic for free.

3. **Linking layer** — keep `service_entry_payments` as the bridge, populated with the `transaction_id` and `ap_payment_id` returned by `apply_ap_ar_payment`. Update `service_entries` totals and `is_closed` exactly as today.

## Behavior change to be aware of

Under the central pipeline, the `transactions` row for a service payment will carry `master_acct_code = 2101` (it represents the cash payment of an AP, which is correct). The expense (e.g. `7010`) lives on the **bill journal**, not the transaction. So in the Transactions list, the service-payment row will show 2101 again — but this time it is correct, because a separate bill journal already booked the expense.

This differs from my earlier patch, which made the single transaction post DR expense / CR Bank directly, bypassing AP journaling. That shortcut works only when there is no real AP cycle (no aging, no partial payments to reconcile against the bill journal). Since the service module supports partial payments, the canonical path is the right answer long-term.

## Technical details

- Resolve chart account IDs once at the top of the RPC: `2101` and the user's selected expense code. Raise a clear error if either is missing or not posting-allowed.
- Pass `v_service.entity_id` and `auth.uid()` into both routines.
- Drop the manual `INSERT INTO transactions` and `INSERT INTO ap_ar_payments`; rely on what `apply_ap_ar_payment` returns.
- Keep current permission, amount-validation, and `is_final_payment` logic at the top of the RPC unchanged.
- Preserve the function signature and return shape so the React caller (`ServicePaymentDialog`) needs no changes.
- One migration; no schema changes; no data migration (you already corrected past rows).

## Out of scope

- Backfilling/re-posting historical service payments — you've handled those manually.
- Touching `create_ap_ar_document` or `apply_ap_ar_payment` themselves.
- UI changes.
