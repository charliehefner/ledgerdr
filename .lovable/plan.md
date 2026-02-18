

# Sales Registration -- Minimal Addition

## Approach

Add a single **Compra / Venta** toggle to the existing Transaction Form. No new pages, no new tables, no clutter. Sales and purchases share the same ledger (the `transactions` table already has `transaction_direction`), so the only change is letting users flip that flag when entering a transaction.

## What Changes

### Transaction Form (`TransactionForm.tsx`)

1. Add a **"Tipo" toggle** (Compra | Venta) at the top of the form, right next to the Cost Center dropdown. Default: Compra.
2. When **Venta** is selected:
   - Sets `transaction_direction = 'sale'` on save
   - Shows a **"Tipo de Ingreso"** dropdown (DGII codes 01-06) instead of Tipo Bienes/Servicios
   - Label for "Name" changes contextually from supplier to customer context ("Cliente" hint)
3. When **Compra** is selected (default, current behavior):
   - Everything works exactly as it does today
   - Optionally shows "Tipo Bienes/Servicios" dropdown for DGII compliance

### `createTransaction` in `api.ts`

- Pass `transaction_direction` through to the insert (currently defaults to `'purchase'` in the DB, so purchases need no change -- only sales need to explicitly send `'sale'`).

### Constants (`dgiiConstants.ts`)

- Already has `TIPO_INGRESO` codes -- no changes needed.

### DGII 607 Report

- Already filters by `transaction_direction = 'sale'` -- sales will automatically appear there once entered.

## What Does NOT Change

- No new pages or tabs
- No new database columns or tables (everything already exists)
- The Recent Transactions table shows both purchases and sales together (they're all transactions)
- No changes to accounting journal generation logic

## Files Modified

| File | Change |
|---|---|
| `src/components/transactions/TransactionForm.tsx` | Add Compra/Venta toggle, conditionally show Tipo Ingreso dropdown, pass `transaction_direction` |
| `src/lib/api.ts` | Include `transaction_direction` in `createTransaction` insert |
| `src/contexts/LanguageContext.tsx` | Add 2-3 translation keys (sale, purchase, income type) |

Total: ~30 lines of new code across 3 files.

