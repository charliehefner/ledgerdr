## Audit: Gaps to Commercial-Grade Accounting Software — IMPLEMENTED

### ✅ 1. Journal Generation: Withholdings (ITBIS Retenido / ISR Retenido)
- `generate-journals` now reads `itbis_retenido` and `isr_retenido` from transactions
- Creates credit lines for accounts 2160 (ITBIS Retenido) and 2170 (ISR Retenido)
- Bank credit amount is reduced by withholding totals to keep journal balanced

### ✅ 2. Journal Generation: Exchange Rate
- `generate-journals` now reads `exchange_rate` from transactions
- Sets `currency` and `exchange_rate` on created journals after RPC call

### ✅ 3. Auto AP/AR Document Creation from Transactions
- TransactionForm auto-creates `ap_ar_documents` record when `due_date` is present
- Direction mapped from transaction_direction (sale→receivable, purchase→payable)
- Links transaction ID via `linked_transaction_ids`

### ✅ 4. AP/AR Payment Generates Journal Entry
- PaymentDialog now creates CDJ (payable) or CRJ (receivable) journal with lines
- Payable: Debit AP (2100) / Credit Bank; Receivable: Debit Bank / Credit AR (1200)
- Requires bank account selection with mapped GL account
- Records in `ap_ar_payments` audit trail table

### ✅ 5. Sale Transactions: Direction-Aware Journal Lines
- Sales (SJ): Debit bank/cash, Credit revenue account, Credit ITBIS por Pagar (2110)
- Purchases (PJ): Debit expense, Debit ITBIS Pagado (1650), Credit bank/cash
- Each line now includes a narrative `description` field

### ✅ 6. AP/AR Payment Audit Trail Table
- Created `ap_ar_payments` table (document_id, payment_date, amount, payment_method, bank_account_id, journal_id, created_by)
- RLS: authenticated SELECT, admin/management/accountant INSERT

### ✅ 7. Payroll Journal Detail Integration (PRJ)
- Closing payroll now generates detailed PRJ journal with:
  - Debit: Salary Expense (7010), Employer TSS (6210)
  - Credit: TSS Liability (2180), ISR Withholding (2170), Loan Deductions (1130), Net Pay to Bank
- Non-fatal: payroll close proceeds even if journal generation fails

### ✅ 8. Bank GL Book Balance Display
- BankAccountsList now shows "Saldo Contable" column
- Queries `account_balances_from_journals` and maps by chart_account_id → account_code

### ✅ 9. Post Journal via Server-Side RPC
- JournalDetailDialog replaced direct `.update({ posted: true })` with `supabase.rpc("post_journal")`
- Ensures server-side balance validation before posting

### ✅ 10. Cost Center Filtering in Financial Reports
- Extended `account_balances_from_journals` DB function with `p_cost_center` parameter
- LEFT JOINs transactions to filter by cost_center when not "all"
- P&L and Balance Sheet views now pass `p_cost_center` to RPC calls
