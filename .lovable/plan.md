

# Dual Language for Treasury Module

## Scope
Six components have hardcoded Spanish strings that need i18n keys:

1. **TreasuryView.tsx** — 4 tab labels
2. **BankAccountsList.tsx** — ~25 strings (headers, buttons, labels, toasts, empty states, dialog titles)
3. **CreditCardsList.tsx** — ~25 strings (same pattern)
4. **CreditCardTransactionsDialog.tsx** — ~10 strings (dialog title, headers, badges, empty state)
5. **PettyCashView.tsx** — ~35 strings (fund management, transaction list, dialog)
6. **ReplenishmentDialog.tsx** — ~20 strings (summary labels, over/short, buttons, toasts)

Note: `BankReconciliationView.tsx` already uses `t()` but has ~10 hardcoded Spanish strings in toast messages and error text that should also be converted.

## Implementation

### 1. Add ~130 i18n keys to both `src/i18n/es.ts` and `src/i18n/en.ts`
Keys will follow existing convention: `treasury.tabs.reconciliation`, `treasury.bank.*`, `treasury.creditCards.*`, `treasury.pettyCash.*`, `treasury.replenishment.*`.

### 2. Update each component
- Import `useLanguage` from `@/contexts/LanguageContext`
- Replace every hardcoded string with `t("treasury.xxx")`
- Pattern is identical to what was done in BankReconciliationView

### 3. Fix remaining hardcoded strings in BankReconciliationView
Convert toast messages like "Sin líneas nuevas", "Importación OFX exitosa", error messages, etc.

No database changes needed.

