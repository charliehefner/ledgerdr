

## Audit: Gaps to Commercial-Grade Accounting Software

After thorough review of the codebase, here are the critical missing pieces organized by priority.

---

### 1. Journal Generation Ignores Withholdings (ITBIS Retenido / ISR Retenido)

**Problem**: The `generate-journals` edge function reads `amount`, `itbis`, and `master_acct_code` from transactions, but completely ignores `itbis_retenido` and `isr_retenido`. These withholding fields exist in the transaction form and are captured on B11 documents, but no journal lines are created for them.

**Impact**: Withholding tax liabilities (accounts 2160 ITBIS Retenido, 2170 ISR Retenido) never appear in financial statements. Balance Sheet understates liabilities; DGII reporting (IT-1, 606) cannot reconcile against the GL.

**Fix**: In `generate-journals/index.ts`, add these fields to the SELECT, then generate additional credit lines for withholding accounts (2160, 2170) when non-zero, reducing the payment account credit accordingly.

---

### 2. Journal Generation Ignores Exchange Rate

**Problem**: The `generate-journals` function does not read `exchange_rate` from transactions. The created journal has no `exchange_rate` set (defaults to 1). This means USD/EUR transactions are recorded at face value in the GL, breaking multi-currency P&L and Balance Sheet calculations.

**Fix**: Read `exchange_rate` from the transaction and pass it to the journal insert via the RPC or a direct column set after creation.

---

### 3. No Automatic AP/AR Document Creation from Transactions

**Problem**: When a purchase or sale transaction is recorded, no corresponding AP/AR document is created. The AP/AR sub-ledger (`ap_ar_documents`) is entirely manual — users must re-enter vendor bills and customer invoices separately. This means:
- Aging reports are incomplete unless manually maintained
- No audit trail linking source transactions to payables/receivables
- Accrual vs. cash basis is disconnected

**Fix**: When a transaction with `due_date` is created (or optionally for all credit purchases/sales), auto-create an `ap_ar_documents` record linked to the transaction. When journal payments are posted, update the AP/AR balance.

---

### 4. AP/AR Payment Does Not Generate a Journal Entry

**Problem**: The `PaymentDialog` updates `amount_paid` and `balance_remaining` on `ap_ar_documents` but creates **no journal entry**. In double-entry accounting, every payment must debit the AP/AR account and credit the cash/bank account. Without this, the GL and sub-ledger are permanently out of sync.

**Fix**: When a payment is registered, also create a journal (type CDJ or CRJ) with lines: Debit AP account (2100) / Credit bank account. Include the payment method to determine which bank GL account to credit.

---

### 5. Sale Transactions: Revenue Journal Lines Are Inverted

**Problem**: In `generate-journals`, sale transactions (`SJ`) use the same debit/credit pattern as purchases — expense account is debited, payment account is credited. For sales, the pattern should be reversed: debit cash/bank, credit revenue. The current code produces incorrect journals for all sales.

**Fix**: Add direction-aware logic: for `sale`, debit the payment account and credit the revenue account. ITBIS on sales should credit a liability account (2110 ITBIS por Pagar), not debit 1650.

---

### 6. No Payment History / Audit Trail for AP/AR Payments

**Problem**: There is no `ap_ar_payments` table. When a payment is applied, only the summary fields on `ap_ar_documents` are updated. There is no record of individual payments (date, amount, method, reference). This fails basic audit requirements — you cannot answer "when was this bill partially paid?"

**Fix**: Create an `ap_ar_payments` table with columns: `id`, `document_id`, `payment_date`, `amount`, `payment_method`, `bank_account_id`, `journal_id`, `notes`, `created_by`, `created_at`. Each payment creates a row here AND a journal entry.

---

### 7. Payroll Journal Integration Is One-Way

**Problem**: Per the memory, "closing a payroll week triggers integration with the ledger via Account 7010." However, this only creates a summary transaction. There is no mechanism to generate the detailed payroll journal with proper GL distribution (salary expense, employer TSS contributions to liability accounts, ISR withholdings, net pay to bank).

**Fix**: When payroll closes, generate a PRJ journal with lines for: Salary Expense (7010), Employer TSS (6210/2180), Employee TSS (2180), ISR Withholding (2170), Net Pay (bank account). This bridges HR and Accounting.

---

### 8. Bank/Credit Card GL Book Balance Not Displayed

**Problem**: Per the memory, "bank accounts are not functionally linked to the General Ledger for real-time book balance display." The Treasury view shows bank accounts as configuration records but does not query the GL for their current book balance. Users cannot see at a glance whether the GL balance matches the bank statement.

**Fix**: In `BankAccountsList`, query `account_balances_from_journals` for each bank's `chart_account_id` and display the GL book balance alongside the bank name.

---

### 9. Posted Journals Bypass Server-Side `post_journal` Function

**Problem**: The `JournalDetailDialog` posts journals by directly updating `posted = true` via client-side Supabase call, bypassing the `post_journal` database function which validates balance. While there is a debit/credit check in the UI, a determined user could bypass it. The `post_journal` RPC provides server-side enforcement.

**Fix**: Replace the direct `.update({ posted: true })` call with `supabase.rpc("post_journal", { p_journal_id, p_user })`.

---

### 10. Cost Center Filtering Not Applied in Financial Reports

**Problem**: The P&L and Balance Sheet views have a cost center dropdown (`costCenter` state), but the `account_balances_from_journals` RPC has no cost center parameter. The filter is UI-only decoration — it does nothing. Reports always show all cost centers combined.

**Fix**: Either extend the RPC to accept a cost center filter, or filter journal lines client-side by joining through the source transaction's `cost_center` field.

---

### Recommended Implementation Order

1. **Journal generation fixes** (withholdings, exchange rate, sale direction) — highest impact, corrupts GL data
2. **AP/AR payment journal creation + payments table** — audit requirement
3. **Post via RPC** — security hardening, quick fix
4. **Auto AP/AR from transactions** — operational efficiency
5. **Bank GL balance display** — Treasury usability
6. **Cost center filtering** — reporting accuracy
7. **Payroll journal detail** — HR-Accounting bridge

### Scope

This is a substantial body of work (~12-15 discrete changes across edge functions, database migrations, and UI components). I recommend tackling them in batches, starting with items 1-3 which are the most critical for data integrity and audit compliance.

