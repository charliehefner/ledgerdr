## Goal

Today, every press of "Confirmar y Guardar" decrements `employee_loans.remaining_payments` by 1, regardless of whether that period already had a deduction recorded. That's button-driven and unsafe (double-press = double advance).

The fix: make **payroll periods (dates)** the source of truth. A loan deducts exactly once per period in which `loan_date <= period.end_date`, and `remaining_payments` becomes a derived value computed from the actual rows in `payroll_loan_deductions`.

## How it should behave

- A loan with `loan_date = 2026-04-20` and 6 payments will deduct in Nómina 96, 97, 98, 99, 100, 101 — exactly once each.
- Pressing "Confirmar y Guardar" twice on the same period inserts the deduction row only once (ON CONFLICT DO NOTHING is already there) and **no longer touches** `employee_loans.remaining_payments`.
- `remaining_payments` and `is_active` on `employee_loans` are kept in sync automatically by a trigger that counts rows in `payroll_loan_deductions`.
- Reopening a closed period (which already deletes its `payroll_loan_deductions` rows) automatically restores the loan's remaining payments.

## Changes

### 1. Rewrite `calculate_payroll_for_period` (RPC)

In the `IF p_commit THEN` block:

- **Remove** the `UPDATE employee_loans SET remaining_payments = remaining_payments - 1, is_active = ...` block entirely.
- Keep the `INSERT INTO payroll_loan_deductions … ON CONFLICT DO NOTHING`, but:
  - Change the `WHERE` from `el.is_active = true AND el.remaining_payments > 0` to a **date-based eligibility check**:
    - `el.loan_date <= v_period.end_date`
    - `(SELECT COUNT(*) FROM payroll_loan_deductions pld WHERE pld.loan_id = el.id AND pld.period_id <> p_period_id) < el.number_of_payments`
  - Recompute `payment_number` from that count + 1 (not from `remaining_payments`).

In the **preview path** (`p_commit = false`), `v_loan_ded` should be calculated the same way (date eligibility + remaining payments derived from `payroll_loan_deductions` count, not from the mutable `remaining_payments` column). This keeps preview and commit consistent and prevents the preview from ever showing a deduction that the date logic would skip.

### 2. New trigger to keep `employee_loans` in sync

```text
trigger: trg_sync_loan_remaining_payments
on:      AFTER INSERT OR DELETE ON payroll_loan_deductions
action:  UPDATE employee_loans
         SET remaining_payments = number_of_payments - (count of pld rows for this loan_id),
             is_active          = (number_of_payments - count) > 0,
             updated_at         = now()
         WHERE id = NEW.loan_id (or OLD.loan_id on DELETE)
```

This means `EmployeeLoansSection.tsx` and the rest of the UI keep working unchanged — `remaining_payments` still reflects reality, it's just computed from period activity instead of button presses.

### 3. One-time backfill

Recompute every loan from the truth:

```text
UPDATE employee_loans el
SET remaining_payments = el.number_of_payments
                       - COALESCE((SELECT COUNT(*)
                                   FROM payroll_loan_deductions pld
                                   WHERE pld.loan_id = el.id), 0),
    is_active = (el.number_of_payments
                 - COALESCE((SELECT COUNT(*) FROM payroll_loan_deductions pld
                             WHERE pld.loan_id = el.id), 0)) > 0,
    updated_at = now();
```

This corrects any loans whose counters drifted from prior double-commits.

### 4. Frontend (small)

`PayrollSummary.tsx` only **reads** `remaining_payments` for display — no changes needed. The two places that compute `payment_number` from `number_of_payments - remaining_payments + 1` will still produce correct values once the trigger keeps the column in sync.

## Files / artifacts

- **DB migration** (new): rewrite `calculate_payroll_for_period`, add `trg_sync_loan_remaining_payments` + its function, run the backfill.
- **No frontend code changes** required.

## Verification

1. On Nómina 97 (status `open`): press "Confirmar y Guardar" twice. Confirm `payroll_loan_deductions` row count for the period is unchanged after the 2nd press, and `employee_loans.remaining_payments` is unchanged.
2. Inspect the loan currently active for the employee in Nómina 97's deduction: its `remaining_payments` after the trigger backfill should equal `number_of_payments - <real count of pld rows>`.
3. Create a test loan with `loan_date` in the future of the current period — confirm it does **not** appear in preview or commit.
4. Reopen a closed period (which deletes its pld rows) — confirm the loan's `remaining_payments` increases by 1 automatically via the trigger.
