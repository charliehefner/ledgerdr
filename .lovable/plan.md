## Problem

Recurring benefits (Teléfono, Gasolina, Bono) stored in `employee_benefits.amount` are entered **per pay period** (bi-monthly), not per month. The live `calculate_payroll_for_period` RPC is dividing them by 2 — so each pay period only credits half the intended amount.

This was fixed once on Apr 15 (migration `20260415172118`), but the function was later dropped (migration `20260430140245_*` only contains `DROP FUNCTION ... calculate_payroll_for_period`) and at some point a stale version with the `/2` divisor was reinstalled. The currently deployed function (verified via `pg_get_functiondef`) again contains:

```sql
SELECT COALESCE(SUM(eb.amount) / 2, 0) INTO v_benefits
FROM employee_benefits eb
WHERE eb.employee_id = v_emp.id AND eb.is_recurring = true AND eb.amount > 0;
```

## Fix

Create a new migration that recreates `public.calculate_payroll_for_period(uuid, boolean, uuid)` identical to the current live definition, with one change at line 126:

```sql
-- Before
SELECT COALESCE(SUM(eb.amount) / 2, 0) INTO v_benefits
-- After
SELECT COALESCE(SUM(eb.amount), 0) INTO v_benefits
```

All other logic (period overrides taking precedence, ISR taxable-income subtraction of `v_benefits`, snapshot writing, loan decrement, etc.) stays untouched.

## Why this is permanent

The bug returned because the function was dropped and recreated outside of the tracked migration that fixed it. Re-asserting the corrected definition in a fresh, dated migration ensures any future `supabase db reset` / replay rebuilds the correct version as the final state. I will also add a short SQL comment on the function noting that `employee_benefits.amount` is **per pay period** to deter future "helpful" halving.

## Out of scope (already correct)

- `IR3ReportView.tsx` and `IR17ReportView.tsx` multiply per-period benefits by 2 to derive a monthly figure for tax computation. Since the input is per-period, `× 2 = monthly` is correct and should not change.
- `period_employee_benefits` (per-period overrides) are already used as-is.

## Validation

After the migration applies, recalculate the current open period and confirm that for an employee with e.g. Teléfono = 2,000 + Gasolina = 3,000 + Bono = 1,000 (all per period), `total_benefits` on the snapshot equals **6,000**, not 3,000.
