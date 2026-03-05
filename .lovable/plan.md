
## ✅ Completed: Remove Investment Direction

Investment direction has been removed. All capital contributions from JORD AB are now handled as Transfers (payment direction) using the From/To bank account dropdowns.

### Changes Made
1. **Edge function** — removed `isInvestment` branch from `generate-journals/index.ts`
2. **TransactionForm** — removed `investment` option, destination account dropdown, and `chartOfAccountsPostable` query
3. **EditTransactionDialog** — removed `investment` option and investment-specific UI
4. **Type definitions** — removed `'investment'` from `transaction_direction` union in `api.ts`
5. **i18n** — removed `txForm.investment`, `txForm.destinationAccount`, `txForm.selectDestinationAccount`, `txForm.fixedAssetReminder`, `dgii.investment` keys
6. **Data migration** — converted all existing `investment` transactions to `payment`
