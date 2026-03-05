

## Rename "Payment" to "Transfer" + Show Internal Accounts

### GAAP & Dominican Compliance Assessment

This change is **fully compliant** with both US GAAP and Dominican NIIF/DGII norms:

- **GAAP**: Internal fund movements between entity-owned accounts (bank-to-bank, bank-to-credit-card, bank-to-petty-cash) are classified as **internal transfers**, not payments. They involve only balance sheet accounts (assets ↔ liabilities) with no P&L impact. The term "Transferencia" is the standard label used in Dominican accounting software (e.g., Softland, Conta5).
- **DGII**: Transfers between own accounts are exempt from NCF requirements (no fiscal document needed), which the system already handles correctly via the `is_internal` flag and the NCF exemption for this direction.
- **Double-entry**: The existing CDJ journal logic (debit destination, credit source) is correct for transfers and does not need to change.
- **JORD AB head office account**: Adding an intercompany/head office account as a transfer destination is standard practice for subsidiaries — it maps to a "Cuentas por Pagar Relacionadas" or "Casa Matriz" liability account.

### Changes

**1. Rename "Payment/Pago" → "Transfer/Transferencia"**

Files: `src/i18n/en.ts`, `src/i18n/es.ts`
- `txForm.payment`: "Payment" → "Transfer" / "Pago" → "Transferencia"

Files: `src/components/invoices/EditTransactionDialog.tsx`
- Update the display label from "Pago" to "Transferencia"

**2. Show From/To account selectors when Transfer is selected**

File: `src/components/transactions/TransactionForm.tsx`
- When `transaction_direction === 'payment'` (internal value stays `payment` to avoid DB migration), show a **"Cuenta Origen" (From)** and **"Cuenta Destino" (To)** section
- **From accounts**: Populated from `bank_accounts` table (banks + petty cash) — these are the source of funds
- **To accounts**: Combined list of:
  - All `bank_accounts` entries (bank, credit_card, petty_cash)
  - A JORD AB head office account (from `chart_of_accounts`, likely an intercompany payable like account 2150 or similar)
- The **From** selection replaces the Pay Method field for transfers (since the source IS a bank account)
- The **To** selection maps to `destination_acct_code` (reusing the existing field that Investment already uses)
- Auto-set `is_internal = true` when Transfer is selected
- Hide NCF/attachment fields for transfers (already handled)

**3. Fetch bank_accounts for the dropdowns**

File: `src/components/transactions/TransactionForm.tsx`
- Add a query for `bank_accounts` with `is_active = true`
- Each entry has `account_name`, `chart_account_code` (linked to chart_of_accounts), and `account_type`
- Group in the dropdown: Banks, Credit Cards, Petty Cash, and Head Office

**4. Ensure JORD AB head office account exists**

- Check if a head office / intercompany account exists in `chart_of_accounts`. If not, add one via migration (e.g., account 2150 "JORD AB - Casa Matriz" as a liability). This account represents amounts owed to/from the parent company.

**5. Journal generation stays the same**

File: `src/components/accounting/useJournalGeneration.ts`
- No changes needed. The CDJ logic already debits `master_acct_code` and credits the payment method account, which is correct for transfers.

### Files Modified
- `src/components/transactions/TransactionForm.tsx` — Transfer From/To dropdowns, fetch bank_accounts
- `src/components/invoices/EditTransactionDialog.tsx` — Label update
- `src/i18n/en.ts`, `src/i18n/es.ts` — Rename labels
- Possible migration: Add JORD AB head office account to chart_of_accounts if not present

