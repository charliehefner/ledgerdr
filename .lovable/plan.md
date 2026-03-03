

## Add "Pago" (Payment) Transaction Direction

### Problem
"Inversión" was designed for head office capital contributions. Using it for routine internal payments (petty cash replenishment, credit card payments) is semantically wrong and confusing. A dedicated **"Pago"** (Payment) direction makes the intent clear.

### How It Works
A new `transaction_direction` value: **`payment`**

When recording a petty cash replenishment or credit card payment:
- **Direction**: Pago
- **Master Account**: The target balance sheet account (e.g., Petty Cash asset account, Credit Card liability account)
- **Payment Method**: The funding source (e.g., Transfer BDI, Transfer BHD)

The journal mechanics are identical to a purchase (Debit master account, Credit payment method account), but the journal type becomes **CDJ** (Cash Disbursements) and no NCF/attachment is required.

### File Changes

| File | Change |
|------|--------|
| `src/components/transactions/TransactionForm.tsx` | Add `payment` to direction dropdown as "Pago"; exempt from NCF requirements like internal transfers |
| `src/components/accounting/useJournalGeneration.ts` | Map `payment` direction to journal type `CDJ`; use same debit/credit logic as purchase |
| `src/lib/api.ts` | Add `'payment'` to `transaction_direction` type union |
| `src/i18n/es.ts` | Add `"txForm.payment": "Pago"` |
| `src/i18n/en.ts` | Add `"txForm.payment": "Payment"` |

### Journal Generation Logic for "Pago"
- **Debit**: Master account (credit card liability, petty cash asset, etc.)
- **Credit**: Payment method mapped account (bank)
- **Journal type**: CDJ (Cash Disbursements)
- Same ITBIS handling as purchase (unlikely for payments, but supported)

### No Database Migration Needed
`transaction_direction` is already a free-text column — no schema change required.

