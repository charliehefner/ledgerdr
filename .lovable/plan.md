## Fixes for Missing Links — COMPLETED

### ✅ 1. AP/AR Payment Recording
- Created `PaymentDialog.tsx` with amount entry, "pay full" shortcut, and auto-status updates
- Added `$` button per row in `ApArDocumentList` for open/partial documents
- Updates `amount_paid`, `balance_remaining`, and `status` (paid/partial) on save

### ✅ 2. Unified Aging Report
- Rewrote `AgingReportView` to pull from `ap_ar_documents` (excludes paid/void)
- Uses `balance_remaining` instead of raw `amount` — reflects partial payments
- Added direction filter (Todos / Cuentas por Pagar / Cuentas por Cobrar)

### ✅ 3. Petty Cash GL Book Balance
- Added `Saldo Contable` column to Petty Cash fund table
- Calls `account_balances_from_journals` DB function and maps by chart account code
- Shows "—" for funds without a mapped GL account

### Deferred: Recurring Entries Automation
Manual "Generar Pendientes" button works; cron requires config.toml changes.
