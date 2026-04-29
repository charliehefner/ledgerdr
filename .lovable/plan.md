## Vacation Day Rounding — Findings & Proposed Fix

### What the calculator does today
The `calculate_prestaciones` SQL RPC computes pending vacation as:

```
entitlement = 14 days  (or 18 if ≥ 5 years of service)
pending = entitlement × (days_since_anchor / 365)   -- rounded to 2 decimals
if pending ≥ 95% of entitlement → snap up to full entitlement
```

So for a worker who is, say, ~6.4 months into the cycle, the screen shows fractional days like **7.40**. That is a pure proportional formula — it does not match the way the Dominican Labour Code is normally liquidated.

### What Dominican legislation says (Código de Trabajo, Art. 177 + Art. 180)

Vacations accrue on a **per-completed-month basis**, not per-day. The fixed scale is:

| Completed months of service in the year | Vacation days payable |
|---|---|
| < 5 months | 0 (no fractional accrual under Art. 177) |
| 5 months | 6 days |
| 6 months | 7 days |
| 7 months | 8 days |
| 8 months | 9 days |
| 9 months | 10 days |
| 10 months | 11 days |
| 11 months | 12 days |
| 1 full year | 14 days |
| ≥ 5 full years | 18 days |

Art. 180 then says that on termination, any vacation **not yet enjoyed** must be paid in cash, using this same scale (proportional to months actually worked in the current vacation cycle). Fractional days are **not** part of the statutory table — Suprema Corte and Ministerio de Trabajo guidance liquidate by whole days using the table above.

### Conclusion
The "7.4 days" you saw is a math artifact, not a legally compliant figure. The legally clean output for ~6 months in the cycle is **7 days** flat.

### Proposed change (single SQL migration, no UI changes)

Rewrite the vacation-days block inside `public.calculate_prestaciones` to use the statutory table:

```sql
-- months completed in the current vacation cycle
v_cycle_months := FLOOR( (p_termination_date - v_vacation_anchor + 1) / 30.4375 );

IF v_total_service_months >= 60 THEN
   -- ≥ 5 years: full cycle = 18 days, prorated linearly by completed months
   v_pending_vacation_days := CASE
     WHEN v_cycle_months >= 12 THEN 18
     WHEN v_cycle_months >=  5 THEN FLOOR(18 * v_cycle_months / 12.0)
     ELSE 0
   END;
ELSE
   -- < 5 years: statutory table (Art. 177)
   v_pending_vacation_days := CASE
     WHEN v_cycle_months >= 12 THEN 14
     WHEN v_cycle_months = 11 THEN 12
     WHEN v_cycle_months = 10 THEN 11
     WHEN v_cycle_months =  9 THEN 10
     WHEN v_cycle_months =  8 THEN 9
     WHEN v_cycle_months =  7 THEN 8
     WHEN v_cycle_months =  6 THEN 7
     WHEN v_cycle_months =  5 THEN 6
     ELSE 0
   END;
END IF;
```

Notes:
- Manual override (`p_pending_vacation_days`) is preserved exactly as today — accountant can still type any number.
- Result is always an integer number of days → no more "7.4".
- Vacation amount keeps using the 12-month average daily salary (already correct per Art. 177).
- The 95%-snap rule becomes unnecessary and is removed.

### Out of scope
- No UI changes; the dialog already accepts integers fine.
- Cesantía and preaviso day calculations are unchanged (those are already on a discrete-days statutory scale).

### Risk
Low. The function is only called from the Benefits dialog, and saved cases keep their stored `pending_vacation_days` value — only **future** calculations will round to whole days.
