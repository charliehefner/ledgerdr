

## Analysis: Is Investment Still Needed?

You're right — with JORD AB (account 2160) now available as a "From" account in Transfers, the Investment direction is redundant. A capital contribution from JORD AB to a local bank is simply a Transfer from JORD AB → Bank.

### Current Differences (Both Produce the Same Double Entry)

| Aspect | Investment | Transfer |
|--------|-----------|----------|
| Journal type | PJ (Purchase) | CDJ (Cash Disbursements) |
| Credit source | `master_acct_code` | `pay_method` (bank account) |
| ITBIS handling | Yes | No |
| Cross-currency | No | Yes (`destination_amount`) |

A JORD AB contribution should generate a CDJ (cash disbursement), not a PJ (purchase). And capital contributions don't have ITBIS. So Transfer is the correct treatment.

### Plan: Remove Investment Direction

**1. Edge function `supabase/functions/generate-journals/index.ts`**
- Remove the `isInvestment` branch entirely
- Any remaining `investment` transactions in the DB will be skipped (or we migrate them — see step 4)

**2. Transaction form `src/components/transactions/TransactionForm.tsx`**
- Remove `investment` from the direction selector
- Remove the standalone "Destination Account" dropdown (only used by investment)
- Remove the `chartOfAccountsPostable` query if no longer needed elsewhere

**3. Edit dialog `src/components/invoices/EditTransactionDialog.tsx`**
- Remove `investment` from direction selector
- Remove the investment-specific destination account section

**4. Data migration**
- Convert existing `investment` transactions to `payment` direction, mapping their `master_acct_code` → `pay_method` and keeping `destination_acct_code` as-is:
```sql
UPDATE transactions
SET transaction_direction = 'payment'
WHERE transaction_direction = 'investment';
```

**5. Type definitions `src/lib/api.ts`**
- Remove `'investment'` from the `transaction_direction` union type

**6. i18n files** — remove `txForm.investment` and `dgii.investment` keys

**7. DGII report views** — remove any `investment` filter/label references

### No new DB columns needed
Existing `pay_method` + `destination_acct_code` + `destination_amount` handle everything.

