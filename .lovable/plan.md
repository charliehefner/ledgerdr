

## Fix: Remove Incorrect `/2` Division on Recurring Benefits

### Root Cause
The `calculate_payroll_for_period` RPC (line 152) divides `employee_benefits.amount` by 2, assuming it represents a monthly figure. In reality, the amount stored is the **per-period value** — the same value shown in the Timesheet cell and paid in full each payroll (as Nomina 94 correctly did).

### Changes

**1. Fix RPC** — Remove the `/ 2` from line 152:
```sql
-- FROM:
SELECT COALESCE(SUM(eb.amount) / 2, 0) INTO v_benefits
-- TO:
SELECT COALESCE(SUM(eb.amount), 0) INTO v_benefits
```

**2. Fix receipt line items** — Remove the `/ 2` from `PayrollSummary.tsx` benefit mapping (lines ~325 and ~604) so individual receipt items show the full stored amount.

**3. Correct Nomina 95 snapshots** — Update the 13 snapshot records with recalculated `total_benefits`, `gross_pay`, and `net_pay` at full benefit values.

**4. Provide difference report** — List each employee's underpayment from Nomina 95 so you can add the difference to the next cycle.

### Scope
| Item | Change |
|------|--------|
| RPC `calculate_payroll_for_period` | Remove `/ 2` on recurring benefits (line 152) |
| `PayrollSummary.tsx` | Remove `/ 2` from receipt benefit line items |
| Nomina 95 snapshots | Update benefit/gross/net values to full amounts |
| Output | List of underpaid amounts per employee |

