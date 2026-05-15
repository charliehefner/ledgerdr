## Goal

After a Nómina period is **closed**, the admin (and any user with payroll export permission) must always be able to re‑download the snapshot‑based PDF receipts (ZIP), even days or weeks later. The data is frozen in `payroll_snapshots` + `payroll_loan_deductions`, so there is no risk of values changing.

## Current behavior (what's wrong)

In `src/components/hr/PayrollSummary.tsx` the "Recibos PDF" button is gated by:

```ts
canExportPayroll && payrollData.length > 0
```

For a closed period, `payrollData` is rebuilt from `payroll_snapshots`, but two things break receipt generation later:

1. **Employee join is fragile.** `employees-with-bank` query filters `is_active = true`. Once a worker is deactivated, their snapshot row maps to `employee_name = "?"`, and `buildLegacyData()` falls back to a synthetic employee with `bank: null, bank_account_number: null, position: ""`. The receipt is generated but missing bank info / position.
2. **Loans query is wrong source for closed periods.** `employee-loans-active` filters `is_active = true AND remaining_payments > 0`. After close, loans may be fully paid or deactivated, so even the fallback `loanDetails` disappears. We already prefer `payroll_loan_deductions` snapshots, but only if the period had snapshot rows written — older periods before that table existed will silently lose loan detail.
3. **Button visibility/UX** — when a closed period is reopened in the UI, `payrollData` briefly becomes empty (snapshots query loading), disabling the button without explaining why. There is no visible "Period is closed — read‑only" hint near the receipts button.

## Plan

### 1. Make snapshots the single source of truth for closed‑period receipts

In `PayrollSummary.tsx`:

- Replace the `employees-with-bank` query (when `isClosed`) with a query that joins **all employees referenced in this period's snapshots**, regardless of `is_active`:
  ```ts
  supabase
    .from("employees_safe")
    .select("id, name, salary, position, bank, bank_account_number")
    .in("id", snapshotEmployeeIds)
  ```
  Run this only when `isClosed && snapshots.length > 0`. Keep the existing active‑employee query for open periods.

- For loan details on closed periods, **only** use `payroll_loan_deductions` (snapshot table). Never fall back to live `employee_loans`. If a closed period has zero rows in `payroll_loan_deductions` but the snapshot's `loan_deduction > 0`, surface a single combined "Préstamo" line in the receipt with the total amount and no parcela counter (graceful degradation for legacy periods).

### 2. Always allow download for closed periods

- Keep the receipts button enabled whenever `isClosed && snapshots.length > 0`, independent of `payrollData.length` (which depends on the employee join finishing). Show a small spinner state while the snapshot/employee queries are still loading.
- Add a short helper line under the button when `isClosed`: *"Nómina cerrada — recibos disponibles para descarga."* (ES) / *"Payroll closed — receipts available for download."* (EN). Add the two strings to `src/i18n/es.ts` and `src/i18n/en.ts`.

### 3. Keep PDF generator unchanged

`src/lib/payrollReceipts.ts` already accepts the legacy data shape and works for both preview and snapshot inputs. No changes needed there. We only feed it cleaner data.

### 4. Verify

- Open a previously closed Nómina → confirm the "Recibos PDF" button is enabled and produces a ZIP with one PDF per employee (including any employee that has since been deactivated).
- Spot‑check one PDF: name, position, bank, bank account, base pay, deductions, net pay, and parcela `N de M` for active loans all match the snapshot row.
- Re‑open the page after a hard refresh and confirm the download still works without re‑previewing or re‑committing.

## Files to change

- `src/components/hr/PayrollSummary.tsx` — add closed‑period employee query, adjust button enablement, drop live‑loans fallback for closed, add status helper text.
- `src/i18n/es.ts`, `src/i18n/en.ts` — two new strings.

No DB migration required — `payroll_snapshots` and `payroll_loan_deductions` already store everything needed.
