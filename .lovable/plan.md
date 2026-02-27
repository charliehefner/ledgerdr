

## Plan: Commercial-Grade Accounting Enhancements

Five features to close the gap, organized by implementation order.

---

### 1. Cash Flow Statement (Indirect Method)

**New file:** `src/components/accounting/CashFlowView.tsx`

- Derives cash flows from P&L net income + balance sheet changes between two dates
- Three standard sections: Operating, Investing, Financing
- Maps account prefixes to sections (e.g., fixed assets → Investing, loans → Financing)
- Computes opening/closing balances for each BS account, shows the delta
- Adds depreciation back to operating section
- Same date/cost-center/exchange-rate toolbar pattern as P&L and BS
- Excel + PDF export
- Added to `AccountingReportsView.tsx` report type selector as `"cf"` option

**i18n keys:** `cf.title`, `cf.operating`, `cf.investing`, `cf.financing`, `cf.netChange`, etc.

---

### 2. Comparative / Multi-Period Reports

**Modified files:** `ProfitLossView.tsx`, `BalanceSheetView.tsx`

- Add a "Compare" toggle that enables a second date-range column (or prior-year column)
- When enabled, runs the same query for the comparison period
- Renders side-by-side columns: Current Period | Prior Period | Variance ($) | Variance (%)
- P&L: compares two date ranges (e.g., Jan-Dec 2025 vs Jan-Dec 2024)
- BS: compares two as-of dates
- Export includes all columns

---

### 3. Audit Log Viewer

**New file:** `src/components/accounting/AuditLogView.tsx`

The `accounting_audit_log` table already exists in the database. This adds a UI to browse it.

- Filterable by date range, table name, action type, user
- Shows: timestamp, user email, table, action (INSERT/UPDATE/DELETE), record ID
- Expandable row to show old_values vs new_values diff (JSON side-by-side)
- Read-only view, no mutations
- Added as a new tab "Auditoría" in `Accounting.tsx`

---

### 4. Journal Approval Workflow (Maker-Checker)

**Database migration:** Add columns to `journal_entries`:
- `approval_status` (enum: `pending`, `approved`, `rejected`, default `pending` for draft journals)
- `approved_by` (uuid, nullable)
- `approved_at` (timestamp, nullable)
- `rejection_reason` (text, nullable)

**Modified files:** `JournalView.tsx`, `JournalDetailDialog.tsx`

- Draft journals start as `pending` approval
- Users with `admin` or `accountant` role (but not the creator) can approve/reject
- Approved journals can then be posted; rejected ones return to draft with a reason
- Journal list shows approval badge (Pending / Approved / Rejected)
- Filter by approval status added to toolbar

---

### 5. AP/AR Sub-Ledger Views

**New sidebar item:** "Cuentas" (Receivables/Payables) at `/accounts` with its own page

**New files:**
- `src/pages/AccountsPayableReceivable.tsx` — TabbedPageLayout with "Cuentas por Cobrar" and "Cuentas por Pagar" tabs
- `src/components/accounting/ReceivablesView.tsx`
- `src/components/accounting/PayablesView.tsx`

**Database migration:** New table `ap_ar_documents`:
- `id`, `document_type` (invoice/credit_memo/debit_note), `direction` (receivable/payable)
- `contact_name`, `contact_rnc`, `document_number`, `document_date`, `due_date`
- `currency`, `total_amount`, `amount_paid`, `balance_remaining`
- `status` (open/partial/paid/void), `linked_transaction_ids` (uuid[])
- `notes`, `created_by`, `created_at`

**Functionality:**
- Create vendor bills / customer invoices with line items
- Apply payments from existing transactions (link transaction to document, reduce balance)
- Credit memo support (negative document that reduces balance)
- Aging summary at top of each view (Current / 30 / 60 / 90 / 90+)
- Statement generation per contact (PDF)

**Sidebar:** Add between "Accounting" and "HR" with `Receipt` icon, section `"ap-ar"`

**Permissions:** Add `"ap-ar"` to the Section type in `permissions.ts`, grant to admin/accountant roles

---

### Summary of Changes

| Feature | New Files | Modified Files | DB Migration |
|---|---|---|---|
| Cash Flow Statement | 1 | 2 (Reports, i18n) | No |
| Comparative Reports | 0 | 4 (PL, BS, i18n×2) | No |
| Audit Log Viewer | 1 | 2 (Accounting.tsx, i18n) | No |
| Approval Workflow | 0 | 4 (Journal*, i18n) | Yes (columns) |
| AP/AR Sub-Ledger | 3 | 5 (Sidebar, routes, permissions, i18n) | Yes (table) |

