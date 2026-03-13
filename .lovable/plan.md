

## Fixes for Missing Links — Ordered by Impact

### 1. AP/AR Payment Recording (Highest Impact)

The `ap_ar_documents` table tracks `amount_paid`, `balance_remaining`, and `status` but there is **no UI to apply a payment**. Documents are created and then sit at "open" forever.

**Fix**: Add a "Registrar Pago" button per row in `ApArDocumentList`. Clicking opens a dialog to enter payment amount and date. On save:
- Update `amount_paid += payment`, `balance_remaining -= payment`
- Set `status` to `paid` if balance reaches 0, `partial` if balance > 0
- Optionally link to an existing transaction ID (autocomplete by name/date)

**File**: `src/components/accounting/ApArDocumentList.tsx`

---

### 2. Unify Aging Report Data Source (High Impact)

Two competing aging systems exist:
- `AgingReportView` → queries `transactions` table by `due_date`
- `ApArDocumentList` → computes aging from `ap_ar_documents`

The `transactions` aging report has no concept of payments, so it always shows the full amount regardless of whether partial payments were applied.

**Fix**: Rewrite `AgingReportView` to pull from `ap_ar_documents` (filtering `status != 'paid'` and `status != 'void'`), using `balance_remaining` instead of `amount`. Add a direction filter (Receivable / Payable / Both) so users can slice the report.

**File**: `src/components/accounting/AgingReportView.tsx`

---

### 3. Petty Cash GL Book Balance (Medium Impact)

Petty cash funds have a `chart_account_id` mapped but the view only shows the static `fixed_amount`. There's no visibility into the actual GL balance from posted journals.

**Fix**: For each petty cash fund with a `chart_account_id`, call `account_balances_from_journals` (existing DB function) to fetch the posted balance. Display it as a "Saldo Contable" column next to the fixed amount.

**File**: `src/components/accounting/PettyCashView.tsx`

---

### 4. Recurring Entries Automation (Lower Impact — works manually today)

Templates exist with `next_run_date` but execution is manual via the "Generar Pendientes" button. No background process runs them automatically.

**Fix**: Create a backend function triggered on a schedule (daily at 6 AM) that finds active templates where `next_run_date <= today`, generates draft RJ journals, and advances the date. This mirrors the existing `generateDueEntries` logic already in the component.

**Files**: New edge function `supabase/functions/run-recurring-journals/index.ts`, cron config in `supabase/config.toml` (read-only, so cron would need manual setup — alternatively, keep manual-only and document the gap).

**Note**: Since `config.toml` is auto-managed and can't be edited, the cron schedule would need to be configured via the backend. Alternatively, this can remain manual with a visual indicator showing overdue templates (which already exists).

---

### Summary — What to implement now

| # | Fix | Impact | Blocked? |
|---|-----|--------|----------|
| 1 | AP/AR payment recording UI | High | No |
| 2 | Unify aging report to use `ap_ar_documents` | High | No |
| 3 | Petty cash GL balance display | Medium | No |
| 4 | Recurring entries cron | Low | Partially (cron config) |

I recommend implementing **#1, #2, and #3** now. #4 can wait since the manual button already works and shows a count of overdue templates.

