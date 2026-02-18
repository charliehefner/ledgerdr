

# Improve Payment Method and Name for Sales

## Payment Method

Keep the same payment methods for both purchases and sales -- no need to differentiate. A "Transfer BDI" is a transfer whether money goes in or out. The DGII mapping in `dgiiConstants.ts` already handles the conversion to the correct "Forma de Pago" code for both 606 and 607 reports.

One addition: add a **"Credito" (Credit)** option to the dropdown. The `PAY_METHOD_TO_DGII` mapping already has `credit: "05"` defined but the UI never shows it. This is relevant for sales where the customer pays on terms.

## Name Field

When "Venta" is selected, change the label from "Nombre" to "Cliente" to give the user proper context. The autocomplete pool stays shared (the same entity can be both a supplier and a customer), which is realistic for a small operation.

## Changes

### `TransactionForm.tsx`

1. **Name label**: Change from `t('txForm.name')` to conditionally show `t('txForm.cliente')` when `transaction_direction === 'sale'`.
2. **Payment method dropdown**: Add a `credit` option labeled "Credito" (mapped to DGII code 05, already in `dgiiConstants.ts`).

### `LanguageContext.tsx`

Add one translation key: `txForm.cliente` = "Cliente" (EN: "Customer").

## What does NOT change

- No new database columns
- No changes to DGII mappings (already correct)
- Payment method dropdown stays unified for both directions
- Name autocomplete pool stays shared

## Technical Detail

| File | Change |
|---|---|
| `src/components/transactions/TransactionForm.tsx` | Conditional label on Name field; add `credit` SelectItem to pay_method |
| `src/contexts/LanguageContext.tsx` | Add `txForm.cliente` translation |

Total: ~5 lines changed across 2 files.

