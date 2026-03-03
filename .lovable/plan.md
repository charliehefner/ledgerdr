

## Tesorería Tab & Petty Cash Payment Method

### Overview
Move Bank Reconciliation (Conciliación) out of the Accounting tab group into a new **Tesorería** (Treasury) tab. This tab will contain sub-tabs for managing all cash/bank/card accounts and their reconciliation. Also add "Petty Cash" as a new payment method.

### 1. New Tesorería Tab in Accounting Page

**File: `src/pages/Accounting.tsx`**
- Replace the `bank-recon` / "Conciliación" tab with a new `treasury` / "Tesorería" tab
- The content component will be a new `TreasuryView`

### 2. New TreasuryView Component

**File: `src/components/accounting/TreasuryView.tsx`** (new)

A sub-tabbed view with 4 sections:
- **Conciliación** — moves the existing `BankReconciliationView` here as-is
- **Cuentas Bancarias** — CRUD for `bank_accounts` table (already exists in DB). List bank accounts with name, bank, account number, currency, linked GL account, active status. Add/edit/deactivate.
- **Tarjetas de Crédito** — Similar CRUD for credit card accounts. Will need a new `credit_card_accounts` table OR we can reuse `bank_accounts` with a `type` column to distinguish bank vs credit card.
- **Caja Chica** — Petty cash management. Shows petty cash fund balance, replenishments, and linked transactions.

### 3. Database Changes

**Add `account_type` column to `bank_accounts`:**
```sql
ALTER TABLE bank_accounts ADD COLUMN account_type text NOT NULL DEFAULT 'bank';
-- values: 'bank', 'credit_card', 'petty_cash'
```

This avoids creating separate tables — all treasury accounts live in `bank_accounts` with a type discriminator. The reconciliation view already queries this table.

### 4. Add Petty Cash Payment Method

**File: `src/components/transactions/TransactionForm.tsx`**
- Add `<SelectItem value="petty_cash">` to the pay_method dropdown (after "cash")

**Files: `src/i18n/es.ts` and `src/i18n/en.ts`**
- Add `"txForm.pettyCash": "Caja Chica"` / `"Petty Cash"`

**Payment method mapping:** The accountant will need to map `petty_cash` to the appropriate GL account via the existing Payment Method Mapping dialog in Settings.

### 5. Treasury Sub-Components

- **BankAccountsList** — table of `bank_accounts` where `account_type = 'bank'`, with add/edit dialog
- **CreditCardsList** — table of `bank_accounts` where `account_type = 'credit_card'`, with add/edit dialog  
- **PettyCashView** — table of `bank_accounts` where `account_type = 'petty_cash'`, plus a summary of linked transactions filtered by `pay_method = 'petty_cash'`

### 6. Summary of File Changes

| File | Change |
|------|--------|
| `src/pages/Accounting.tsx` | Replace bank-recon tab with treasury tab |
| `src/components/accounting/TreasuryView.tsx` | New — sub-tabbed treasury container |
| `src/components/accounting/BankAccountsList.tsx` | New — bank accounts CRUD |
| `src/components/accounting/CreditCardsList.tsx` | New — credit cards CRUD |
| `src/components/accounting/PettyCashView.tsx` | New — petty cash management |
| `src/components/transactions/TransactionForm.tsx` | Add petty_cash option |
| `src/i18n/es.ts` | Add petty cash + treasury translations |
| `src/i18n/en.ts` | Add petty cash + treasury translations |
| DB migration | Add `account_type` column to `bank_accounts` |

