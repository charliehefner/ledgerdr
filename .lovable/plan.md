

## Fix Prestaciones Calculation to Match Ministry of Labor

### Problem
Two calculation formulas differ from the Ministry of Labor's official calculator:

1. **Cesantía uses prorated months; Ministry uses complete years**
   - Art. 80 C.T.: "21 days per year" for 1-5 years of service
   - Ministry interprets this as 21 × complete_years (e.g., 2 years = 42 days)
   - App currently does `21 × total_months / 12` which prorates partial years (e.g., 2y1m = 44.3 days)

2. **Vacation accrual gives fractional days; Ministry rounds to entitlement**
   - Ministry gives full 14 days when nearly a full year has elapsed since last vacation
   - App gives proportional 13.73 days

### Data Issues to Fix
- Employee hire date: change from 2024-04-02 to 2024-04-01 to match actual date
- Salary history effective_date: `0024-02-14` should be `2024-02-14` (year typo)

### Changes

**Database migration — update `calculate_prestaciones` function:**

1. **Cesantía logic** — change from prorated months to complete years:
   ```sql
   -- CURRENT (prorated):
   v_cesantia_days := ROUND(21 * v_total_service_months / 12.0, 2);
   
   -- FIXED (complete years, matching Ministry):
   v_cesantia_days := 21 * v_service_years;
   ```
   Same fix for the 5+ year bracket (23 × complete years).

2. **Vacation rounding** — round up to full entitlement when accrued days are within 1 day of the entitlement:
   ```sql
   -- After proportional calculation, round up if >= 95% of entitlement
   IF v_pending_vacation_days >= (v_vacation_entitlement * 0.95) THEN
     v_pending_vacation_days := v_vacation_entitlement;
   END IF;
   ```

3. **Data fix** — correct the employee's hire date and salary history date via migration.

### Steps
1. Create a database migration with the corrected `calculate_prestaciones` function
2. Include data fix for employee hire date and salary history date
3. No UI changes needed — the dialog already calls the RPC

### Expected Result After Fix
Running Cedeño's calculation with termination date 2026-04-30 should produce values matching the Ministry's totals within a few pesos of rounding.

