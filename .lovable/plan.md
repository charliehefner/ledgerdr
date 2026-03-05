

## Cross-Currency Transfer Support

### About Account 0000 for Transfers

Yes, keeping `master_acct_code = '0000'` (Transferencia Interna) for all transfers is **correct and reasonable**. It serves as a **classification marker**, not an accounting account. The actual debit/credit accounts come from the From/To selections. However, the current journal generation code has a problem: for `payment` direction transactions, it tries to look up `0000` in `chart_of_accounts` as the "expense account" — and since `0000` is not a real postable account, transfers will be **skipped during journal generation** with "cuenta gasto '0000' no encontrada."

This means **transfers currently fail to generate journals**. The fix requires adding a dedicated transfer branch in the journal generation logic.

### Current Problem

When a cross-currency transfer is recorded (e.g., USD bank → DOP bank), the system captures only one `amount` and one `currency`. The journal would debit and credit the same number, which is incorrect — the source loses $1,000 USD but the destination gains RD$58,000 DOP. These are different values that must be recorded separately.

### Changes

**1. Add destination amount field to the Transfer form**

File: `src/components/transactions/TransactionForm.tsx`
- Add `transfer_dest_amount` to form state
- When Transfer is selected and From/To accounts have different currencies, show a second amount field: "Monto Destino" (Destination Amount)
- Auto-calculate and display the implied exchange rate between the two amounts
- The existing `amount` field becomes the **source amount** (what leaves the origin account)
- The existing `currency` field stays as the **source currency**
- Add a `transfer_dest_currency` field that auto-detects from the destination bank account's currency

**2. Look up bank account currencies**

File: `src/components/transactions/TransactionForm.tsx`
- Expand the `bank_accounts` query to include `currency`
- When From or To selection changes, detect if currencies differ and show/hide the destination amount field accordingly

**3. Fix journal generation for transfers**

File: `src/components/accounting/useJournalGeneration.ts`
- Add a dedicated `isTransfer` branch (where `transaction_direction === 'payment'`)
- For transfers, the journal logic is:
  - **Debit**: Destination account (from `destination_acct_code`) for the destination amount
  - **Credit**: Source account (from `pay_method`, resolved via `payment_method_accounts` or directly from `bank_accounts.chart_account_id`) for the source amount
  - If amounts differ (cross-currency): book the difference to an **exchange gain/loss account** (account `8510 - Diferencia Cambiaria` or similar)
- Journal type remains `CDJ`
- Skip the standard purchase/sale logic that tries to use `master_acct_code` as an expense account

**4. Store destination amount in the transaction**

- The `transactions` table needs a field to hold the destination amount. Options:
  - Reuse `comments` or another field (not clean)
  - Add a `destination_amount` column via migration
- A migration adds `destination_amount NUMERIC(15,2)` to `transactions`

**5. Ensure exchange gain/loss account exists**

- Check for account `8510` or similar in chart_of_accounts. If not present, add via migration. This is a standard "Otros Gastos / Diferencia Cambiaria" account per Dominican chart standards.

### GAAP/Dominican Compliance

- **NIIF (IAS 21)**: Foreign currency transactions must be recorded at the exchange rate on the transaction date. Exchange differences on settlement go to P&L (Diferencia Cambiaria).
- **DGII**: Exchange gains/losses are reportable income/expense items. The 8510 account is standard in Dominican charts.
- **Double-entry**: The journal balances in base currency (DOP) by using the exchange rate to convert the foreign amount and booking any difference to the FX account.

### Files Modified
- `src/components/transactions/TransactionForm.tsx` — destination amount/currency fields, currency detection
- `src/components/accounting/useJournalGeneration.ts` — dedicated transfer branch with cross-currency support
- Migration: add `destination_amount` column to `transactions`, add exchange gain/loss account if missing

