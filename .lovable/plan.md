

# Fix: AP/AR Account Prefix Mismatch

## Problem
Transaction 361 (credit purchase, DOP 55,134.21 to Charles Hefner) was saved correctly but no AP document was auto-created. The auto-creation code and the Payables list both use GL account prefix `'21%'` to find Accounts Payable accounts, but your chart of accounts has AP under `'24%'` (e.g., `2440 - Cuentas a pagar`). The `'21%'` prefix incorrectly matches tax reserve accounts (`2110`).

## Fix

### 1. Update account prefix in TransactionForm.tsx (line ~344)
Change the payable prefix from `'21'` to `'24'` so auto-created AP documents link to `2440 - Cuentas a pagar`.

### 2. Update account prefix in ApArDocumentList.tsx (line 79)
Change the payable prefix from `'21'` to `'24'` so the GL account dropdown and display show the correct AP accounts.

### 3. Repair transaction 361
Insert the missing AP document for transaction 361 via a one-time data patch (migration), linking it to the `2440` account with the correct amount, due date, and contact info.

### Files Modified
- `src/components/transactions/TransactionForm.tsx` — change payable prefix `'21'` → `'24'`
- `src/components/accounting/ApArDocumentList.tsx` — change payable prefix `'21'` → `'24'`
- New migration — insert missing AP document for transaction 361

