

## Add EUR Currency Option System-Wide

### Scope
EUR needs to be added as a third currency option everywhere DOP and USD currently appear. This touches **14 files** across transactions, accounting, treasury, HR, reports, and the type system.

### Changes by Category

**1. Type definition** — `src/lib/api.ts`
- Change `currency: 'DOP' | 'USD'` to `'DOP' | 'USD' | 'EUR'` in the `Transaction` interface
- Update all `as 'DOP' | 'USD'` casts to include `'EUR'`

**2. Currency dropdowns** — Add `<SelectItem value="EUR">EUR</SelectItem>` in all 13 locations:
| File | Context |
|------|---------|
| `src/components/transactions/TransactionForm.tsx` | New transaction form |
| `src/components/invoices/EditTransactionDialog.tsx` | Edit transaction dialog |
| `src/components/accounting/ChartOfAccountsView.tsx` | Account currency |
| `src/components/accounting/ApArDocumentList.tsx` | AP/AR documents |
| `src/components/accounting/PettyCashView.tsx` | Petty cash |
| `src/components/accounting/CreditCardsList.tsx` | Credit cards |
| `src/components/accounting/BankAccountsList.tsx` | Bank accounts |
| `src/components/accounting/BankReconciliationView.tsx` | Bank reconciliation (native `<option>`) |
| `src/components/accounting/JournalEntryForm.tsx` | Manual journal entries |
| `src/components/accounting/RecurringEntriesView.tsx` | Recurring entries (native `<option>`) |
| `src/components/hr/ServicesView.tsx` | Service provider entries |
| `src/components/hr/ServiceProvidersView.tsx` | Service provider form |
| `src/pages/Reports.tsx` | Currency filter dropdown |

**3. Financial statements** — `ProfitLossView.tsx`, `BalanceSheetView.tsx`, `CashFlowView.tsx`
- EUR transactions should be converted to RD$ using the exchange rate (same pattern as USD)
- Add an `EUR` column in reports when EUR transactions exist (mirroring the `hasUsd` / `US$` pattern with `hasEur` / `€`)

**4. Display helpers**
- `src/lib/numberToWords.ts` — Add "euros" label for EUR
- `src/components/hr/ServicesView.tsx` — Add `€` symbol alongside existing `RD$` / `US$` logic
- `src/components/dashboard/FiscalDocumentsReport.tsx` — Add EUR accumulator
- `src/components/inventory/PurchaseTotalsByAccount.tsx` — Add EUR total
- `src/pages/Reports.tsx` — Add EUR total in account summaries

**5. Localization** — `src/i18n/es.ts` and `src/i18n/en.ts`
- No new keys needed (EUR is a universal abbreviation)

### No Database Migration Needed
The `currency` column in `transactions` is a VARCHAR/text field, not an enum — it already accepts any string value.

