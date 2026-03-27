

## Fix: Investment Transaction Validation Bug

### Root Cause

There is a **mismatch between the UI cross-currency detection and the validation logic** when JORD AB (a COA account, not a bank account) is selected as From or To:

**UI logic** (line 702-706) — defaults currency to `''` (empty string) when account is not found in `bankAccounts`:
```
fromCurrency = fromAccount?.currency || '';  // '' when COA
```
Result: `isCrossCurrency = '' && ...` → always `false` → **cross-currency dest amount field never shows**

**Validation logic** (line 221-225) — defaults currency to `'DOP'` when account is not found:
```
fromCur = fromAcct?.currency || 'DOP';  // 'DOP' when COA
```
Result: If the other account is USD, validation thinks it's cross-currency, requires `transfer_dest_amount`, but that field was never shown → **validation silently fails**

Even without JORD AB, the generic "required fields" error message doesn't tell the user *which* field is missing.

### Changes

**`src/components/transactions/TransactionForm.tsx`** — two fixes:

1. **Align cross-currency defaults**: In the UI rendering block (line ~702-706), change the currency defaults from `''` to `'DOP'` to match validation:
   ```ts
   const fromCurrency = fromAccount?.currency || 'DOP';
   const toCurrency = toAccount?.currency || 'DOP';
   const isCrossCurrency = fromCurrency !== toCurrency;
   ```
   This ensures the cross-currency dest amount field **shows** when it's actually needed.

2. **Improve error messages**: In the `handleSubmit` validation block (line ~241-249), add specific messages for investment/transfer failures:
   - Missing From account → "Seleccione cuenta origen"
   - Missing To account → "Seleccione cuenta destino"
   - Self-transfer → "Origen y destino no pueden ser iguales"
   - Missing cross-currency amount → "Ingrese monto destino para transferencia multi-moneda"

No database changes needed.

