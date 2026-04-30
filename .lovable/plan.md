## Vacation Day Calculation — Align with Ministerio de Trabajo

### Problem
Yesterday's migration applied the Article 180 monthly scale (6 to 12 days) to everyone. That scale is only meant for employees with less than 1 year of continuous service (Art. 179). The Ministry's official calculator (and Articles 177 + 184) instead pay the **full** statutory entitlement at termination for any employee with 1+ year of service.

For Reynaldo Cedeño this produced 12 days / RD$50,230 instead of the Ministry's 14 days / RD$58,602 — a RD$8,372 underpayment. The same flaw affects every long-tenure employee mid-cycle.

### Fix
Single SQL migration to `calculate_prestaciones`. New vacation-day rules, applied to **all** employees:

1. **Manual override** typed by the accountant — always respected.
2. **Cycle already enjoyed** (termination before the next anchor) — 0 days.
3. **Service ≥ 1 year** — full Article 177 entitlement: **14 days**, or **18 days** if total service ≥ 5 years. Not prorated by months in the current cycle. This matches the Ministry's calculator.
4. **Service < 1 year** — Article 179 + 180 monthly scale (5m=6, 6m=7, …, 11m=12 days).

Vacation amount continues to use the 12-month average daily salary (already correct per Art. 177).

### Other behaviour preserved
- Preaviso, cesantía, regalía, loan deductions and manual adjustments untouched.
- All other parts of the function unchanged.
- No UI changes required.

### Verification
After deploy, recalculating Reynaldo (hire 1 Apr 2024, termination 30 Apr 2026) returns:

```text
Preaviso       28 days   RD$117,205.20
Cesantía       42 days   RD$175,807.81
Vacation       14 days   RD$ 58,602.60
Regalía         4 months RD$ 33,250.00
TOTAL                    RD$384,865.61
```

— matching the Ministerio de Trabajo PDF exactly.

### Risk
Low. Function is only called from the Benefits Calculator dialog. Saved liquidations keep their stored values; only future calculations use the new rule.
