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

---

## CRM Contacts Module — COMPLETED

### ✅ Database
- `contacts` table (name, RNC unique, contact_type, contact_person, phone, email, address, notes, is_active)
- `contact_bank_accounts` table (one-to-many, bank_name, account_number, account_type, currency, is_default)
- RLS: authenticated SELECT; admin/management/accountant INSERT/UPDATE; admin/management DELETE

### ✅ UI: `/contacts` page
- CRUD table with search, type filter, active toggle
- Dialog with general info + collapsible bank accounts section (add/remove rows, default star)
- Bilingual (ES/EN) via i18n keys

### ✅ OCR → CRM prompt
- After OCR extracts RNC, lookup in contacts table
- If not found, inline banner: "¿Desea agregar este contacto al CRM?"
- Confirm inserts as supplier

### ✅ NameAutocomplete integration
- Queries contacts table + legacy transaction names, deduplicated
- Selecting a CRM contact auto-fills RNC
