# Apply Overtime Fix: 1.35× for All Employees

## Change

Update the `calculate_payroll_for_period` RPC: replace the overtime formula

```sql
v_overtime_pay := round(v_ot_hours * v_hourly_rate * 0.35, 2);  -- premium only
```

with

```sql
v_overtime_pay := round(v_ot_hours * v_hourly_rate * 1.35, 2);  -- base + premium
```

This applies automatically to every employee whose hours go beyond the contractual schedule (Mon–Fri 7:30–16:30 = 8 hrs, Sat 7:30–11:30 = 4 hrs). Gerencia/exempt positions remain excluded by the existing frontend filter (no OT hours sent to RPC).

## Unchanged

- **Sunday pay** stays at `× 0.35` (premium-only).
- **Holiday pay** stays at `days_holiday × daily_rate` (one extra day).
- **Lunch deduction** (subtract 1 hr when day > 5 hrs) unchanged.
- **OT-hours threshold logic** (>8 weekday, >4 Saturday) unchanged.

## Recompute Required

After the migration runs, open the current April 16–30 period and click **Recalcular** so all snapshot rows refresh. Gross/TSS-base/ISR/net will all update.

## Expected Impact (April 16–30 period)

| Employee | OT hrs | Old OT | New OT |
|---|---|---|---|
| Luis Miguel Avelino (sal 42,000) | 2.25 | $173.49 | $669.19 |

All other employees with OT in the period scale by ~3.86×.

## Files

- New migration: `supabase/migrations/<timestamp>_overtime_135x_payment.sql` — replaces the RPC body with the 1.35× line.
- No frontend changes (PayrollSummary, PayrollTimeGrid, payrollReceipts already render whatever the RPC returns).
