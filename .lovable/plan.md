
What went wrong
- The repeated payment is not just a display issue. The app created multiple real transaction rows:
  - Keep: transaction 433
  - Duplicates: 434, 435, 436, 437, 438, 439
- I confirmed 433 is the correct one to preserve because it is the only one currently linked to:
  - the payment audit row in `ap_ar_payments`
  - journal `CDJ-000010`
- Transaction 440 is a different valid payment (`Pago a Charles Hefner — 361`) and should stay as-is.

Answer to your question
- No, transaction 440 should not be renumbered.
- In this system, `legacy_id` is treated as a visible accounting/document number, and the codebase already follows a voiding approach for corrections rather than renumbering old records.
- Renumbering 440 to close the gap would be risky because other records, exports, audit references, or user notes may already point to `440`.

Plan
1. Clean up the duplicates by removing only the bad records
- Delete transactions 434-439
- Delete their linked journals `CDJ-000011` through `CDJ-000016`
- Keep transaction 433 and its linked journal/payment audit intact

2. Do not resequence transaction numbers
- Leave 440 as 440
- Accept the numbering gap as part of the audit trail after cleanup

3. Prevent this from happening again
- Patch the payment flow in `src/components/accounting/PaymentDialog.tsx`
- Add a submission guard so repeated clicks/retries cannot create the same payment multiple times
- Make the mutation idempotent enough for UI retries:
  - disable the submit action while saving
  - stop creating a second transaction if the journal/payment was already created for that same action
  - surface a clearer error/success state

4. Verify the accounting links after cleanup
- Confirm the document still has one payment audit row
- Confirm only one journal remains for document 349
- Confirm transaction 433 still appears and 434-439 no longer do
- Confirm 440 remains untouched

Technical details
- Relevant live data confirmed:
  - `433` → linked to `ap_ar_payments.notes = TX-433`
  - journal kept: `CDJ-000010`
  - duplicate journals: `CDJ-000011` to `CDJ-000016`
- This is a data cleanup plus prevention fix:
  - data cleanup in backend records
  - code hardening in `PaymentDialog.tsx`
- I would not renumber `legacy_id` values because they behave like human-facing document references and the app already distinguishes valid vs invalid records through record state/cleanup, not resequencing.
