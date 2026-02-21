

# Recording Head Office Transfers (Capital Contributions)

## The Accounting Problem

Head office transfers are **not income** -- they are intercompany transactions that increase the subsidiary's assets while creating a liability (or equity entry) to the parent company. Your chart of accounts already has the correct accounts for this:

- **2460** - Empresas del grupo de cuentas por pagar (Intercompany Payable)
- **2093** - Contribuciones de los accionistas recibidas (Shareholder Contributions)

The current system only supports "Purchase" and "Sale" directions, both of which assume expense-to-payment or income-to-deposit flows. A third direction is needed.

## Two Scenarios

1. **Cash transfer from HQ**: Money arrives in your bank account
   - Journal: Debit Bank Account (e.g. 1110 BDI) / Credit 2460 Intercompany Payable
2. **Equipment transfer from HQ**: Equipment arrives with an invoice
   - Journal: Debit Fixed Asset Account (e.g. 1220 Machinery) / Credit 2460 Intercompany Payable
   - If the item is a fixed asset, it should also be registered in the Fixed Assets module

## Plan

### 1. Add "Investment" Transaction Direction

Add a third option to the Type dropdown in the Transaction Form:
- Purchase (existing)
- Sale (existing)
- **Investment** (new) -- labeled "Inversión" in Spanish

### 2. UI Behavior When "Investment" Is Selected

- **Master Account** becomes the **credit account** (e.g. 2460 Intercompany Payable, 2093 Contributions)
- A new **"Destination Account"** dropdown appears, allowing selection of where the value lands:
  - A bank account (for cash transfers)
  - A fixed asset account (for equipment transfers)
  - Any other asset account
- **DGII fields** (Tipo Ingreso, Tipo Bienes/Servicios) are hidden (not applicable)
- **NCF/attachment** requirements remain optional (equipment may have invoices)
- All other fields (amount, currency, description, name, document) remain available

### 3. Update Journal Auto-Generation

Modify `useJournalGeneration.ts` to handle `transaction_direction = 'investment'`:

```text
For investment transactions:
  Debit:  destination_account (the bank or fixed asset account)
  Credit: master_acct_code (the intercompany/equity account)
  
  If ITBIS exists:
    Debit: 1650 ITBIS Pagado (for equipment with tax)
    Credit amount increases accordingly
```

This is the reverse of the purchase journal pattern.

### 4. Database Changes

- Add a new column `destination_acct_code` (text, nullable) to the `transactions` table for storing the debit-side account on investment transactions
- No new tables needed; uses existing chart of accounts

### 5. Fixed Asset Integration

When an investment transaction uses a fixed asset account code (accounts starting with 12xx like 1220, 1230, etc.) as the destination:
- Display an informational note: "Remember to register this equipment in the Fixed Assets module (Accounting > Activos Fijos)"
- No automatic fixed asset creation (the user's existing workflow handles this manually through the Fixed Assets tab)

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/components/transactions/TransactionForm.tsx` | Add 'investment' direction option, add destination account dropdown, conditional DGII field hiding |
| `src/components/accounting/useJournalGeneration.ts` | Handle reversed debit/credit logic for investment direction |
| `src/types/index.ts` | Update Transaction type with `destination_acct_code` field |
| `src/i18n/en.ts` and `src/i18n/es.ts` | Add translation keys for "Investment/Inversion" and "Destination Account/Cuenta Destino" |
| `src/components/transactions/RecentTransactions.tsx` | Display 'Investment' badge for the new direction |
| `src/pages/Reports.tsx` | Show investment direction in ledger/reports |

### Database Migration

```sql
ALTER TABLE transactions 
  ADD COLUMN destination_acct_code text;
```

### Journal Generation Logic Change

```text
IF transaction_direction = 'investment':
  debit_account  = destination_acct_code  (bank or fixed asset)
  credit_account = master_acct_code       (intercompany/equity)
ELSE (purchase):
  debit_account  = master_acct_code       (expense)
  credit_account = payment_method_mapping  (bank)
```

