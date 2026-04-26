
## Goal
Bring `calculate_prestaciones` RPC fully in line with the Dominican Republic Labor Code (Arts. 80 & 177) so all employees — not just Jose Luis — get the legally correct settlement.

## Findings (current vs. law)

| Concept | Current code | Law / Ministry | Fix needed? |
|---|---|---|---|
| Preaviso (Art. 76) | 7 / 14 / 28 days by tenure band | Same | ✅ correct |
| **Cesantía (Art. 80)** | Counts only **complete years** × 21 or 23 days. Partial-year band only applied when total service < 1 year. | Complete years × 21/23 **PLUS** an extra band for the **last incomplete year** (6 days if 3–6 months, 13 days if 6+ months) | ❌ **Fix** |
| **Vacation pay (Art. 177)** | Uses **full-history weighted average** salary | Must use **average ordinary salary of last 12 months** (or period worked, if shorter) | ❌ **Fix** |
| Vacation entitlement days (Art. 177) | 14 days < 5 yrs, 18 days ≥ 5 yrs (with 95% rounding) | Same | ✅ correct |
| Regalía (Law 16-92) | Sum of monthly salary in current calendar year ÷ 12 | Same | ✅ correct |
| Loans / manual adj. | Pass-through | n/a | ✅ correct |

## Changes

### 1. Cesantía — add partial-year tail (Art. 80)
Replace lines 158–171 of the RPC with logic that:
- Computes complete years (`v_service_years`) AND the **remainder months in the last partial year**.
- Adds the daily band for the remainder on top of the years calculation:
  - remainder ≥ 6 months → +13 days
  - 3 ≤ remainder < 6 months → +6 days
  - < 3 months → +0
- Day rate per complete year stays 21 (1–4 yrs) or 23 (≥ 5 yrs).

Verification target — Jose Luis Cespedes (1 yr 6 mo, daily ≈ RD$1,129.09):
- Days: 21 + 13 = **34**
- Amount: 34 × 1,129.09 ≈ **RD$38,389** (matches Ministry document)

### 2. Vacation salary basis — last 12 months only (Art. 177)
Add a second weighted-average calculation that restricts segments to the window `GREATEST(date_of_hire, p_termination_date - INTERVAL '12 months')` … `p_termination_date`.

- Introduce `v_avg_monthly_salary_12m` and `v_daily_salary_vacation`.
- Use `v_daily_salary_vacation` **only** for `v_vacation_amount`.
- Keep `v_daily_salary` (full-history weighted average) for cesantía / preaviso, which is the standard practice for severance basis.

### 3. Response payload (transparency)
Extend `salary_basis` JSON with:
- `average_monthly_12m`
- `daily_salary_vacation`
- `cesantia_breakdown`: `{ complete_years, remainder_months, days_from_years, days_from_remainder }`

This lets the UI explain the calculation if questioned by an employee or the Ministry.

### 4. UI — `PrestacionesCalculatorDialog.tsx`
- Show the new vacation daily-rate line (small caption under the vacation row): "Base vacacional: promedio últimos 12 meses".
- Show cesantía breakdown ("21 d × 1 año + 13 d (6 meses)") when partial-year band applies.
- No behavioral changes to overrides — user can still manually adjust pending vacation days.

## Implementation steps
1. **Migration** — `CREATE OR REPLACE FUNCTION public.calculate_prestaciones(...)` with the two changes above. Signature unchanged.
2. **UI tweak** in `src/components/hr/PrestacionesCalculatorDialog.tsx` to render the new fields.
3. **Smoke check** by re-running the Jose Luis scenario from the calculator and confirming the total lands at ≈ RD$87,454 (matching the Ministry PDF).

## Out of scope
- Recomputing/restating any previously settled employees. Fix is forward-looking — applies to all future calculations regardless of employee.
- No schema changes (function body only).
- No change to preaviso, regalía, loan, or override logic.
