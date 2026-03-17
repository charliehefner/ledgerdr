

# Make "Registrar Pago" Also Create a Transaction Record

## Problem
Currently, AP/AR payments only create a journal entry and audit record but no `transactions` row. This means payments don't appear in the main Transactions ledger and lack a `legacy_id` for reference.

## Change: `src/components/accounting/PaymentDialog.tsx`

After creating the journal and before updating `ap_ar_documents`, insert a transaction record using the dialog's existing data:

| Transaction Field | Source |
|---|---|
| `transaction_date` | `paymentDate` from dialog |
| `description` | `"Pago a/de {contact_name} — {document_number}"` (same as journal) |
| `amount` | Payment amount |
| `currency` | `document.currency` |
| `pay_method` | `bankAccountId` (UUID of selected bank account) |
| `name` | `document.contact_name` |
| `master_acct_code` | Look up the AP/AR account code from `chart_of_accounts` using `apArAccountId` |
| `transaction_direction` | `"purchase"` for payable, `"sale"` for receivable |
| `is_internal` | `false` |
| `cost_center` | `"general"` |
| `exchange_rate` | Fetched rate (if non-DOP) |

After inserting, the returned transaction's `id` will be used to:
1. Link the journal via `transaction_source_id` (update the journal created above)
2. Set `document_number` on the `ap_ar_payments` audit record to the new `legacy_id`

This keeps full traceability: Transaction ↔ Journal ↔ AP/AR Payment.

### Implementation detail
- Use `supabase.from("transactions").insert({...}).select().single()` to get back the `id` and `legacy_id`
- Fetch the `account_code` from `chart_of_accounts` for the AP/AR account to populate `master_acct_code`
- Update the journal's `transaction_source_id` to the new transaction ID
- Non-fatal: if the transaction insert fails, log the error but still complete the payment flow

