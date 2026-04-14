

## Fix: TSS and ISR Not Calculating (Wrong Parameter Key Names)

### Root Cause

There are two overloads of `calculate_payroll_for_period`:
- **2-arg version** (p_period_id, p_commit) — uses correct keys: `afp_employee_pct`, `sfs_employee_pct`, `afp_cap_monthly`, `sfs_cap_monthly`
- **3-arg version** (p_period_id, p_commit, p_entity_id) — uses wrong keys: `employee_afp_rate`, `employee_sfs_rate`, `afp_salary_cap`, `sfs_salary_cap`

The frontend (PayrollSummary) calls the 3-arg version. Since those keys don't exist in `tss_parameters`, all four variables are NULL, making TSS = NULL and ISR = NULL → zero deductions for everyone.

This was introduced by the earlier migration that recreated the function with the holiday fix — it used stale key names in the first overload.

### Fix

Single migration to drop and recreate the 3-arg overload, replacing the four wrong parameter keys with the correct ones:

| Wrong key | Correct key |
|---|---|
| `employee_afp_rate` | `afp_employee_pct` |
| `employee_sfs_rate` | `sfs_employee_pct` |
| `afp_salary_cap` | `afp_cap_monthly` |
| `sfs_salary_cap` | `sfs_cap_monthly` |

Also add COALESCE defaults (matching the 2-arg version) and divide percentages by 100, since the values are stored as `2.87` / `3.04`, not `0.0287` / `0.0304`.

One migration file. No frontend changes needed.

