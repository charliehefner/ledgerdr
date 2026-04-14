

## Audit: Two Divergent Payroll Functions — Root Cause and Hidden Issues

### What Happened

The first holiday-fix migration (20260414150040) **dropped and recreated both overloads** of `calculate_payroll_for_period`. The 3-arg version (which the frontend actually calls) was recreated from a stale copy with wrong parameter keys and missing logic. Each subsequent fix patched one symptom but introduced further drift. You now have two overloads that calculate payroll **differently**.

### Hidden Issues Found (3-arg overload vs 2-arg)

| # | Issue | Severity | Detail |
|---|---|---|---|
| 1 | **Loan decrement missing on commit** | Critical | When you Close Period via the 3-arg overload, `employee_loans.remaining_payments` is never decremented. Loans will never pay down. |
| 2 | **Benefits source wrong** | High | 2-arg reads `period_employee_benefits` first (per-period overrides), falls back to `employee_benefits / 2`. 3-arg reads only `employee_benefits` (full amount, not halved). Benefits may be doubled. |
| 3 | **No intermediate rounding** | Medium | 2-arg rounds all intermediate values to 2 decimals. 3-arg doesn't round at all, causing penny drift across employees. |
| 4 | **2-arg OT still has the old lunch bug** | Medium | The 2-arg overload was never patched with the lunch deduction fix — it still uses raw `hours_worked - 8`. If anything ever calls the 2-arg, OT will be wrong. |
| 5 | **Snapshot column mismatch** | Low | 2-arg saves to `payroll_snapshots` with column names like `tss`, `total_benefits`. 3-arg uses `tss_deduction`, `benefits`. If the table has both sets, one set will be NULL. |

### Plan: Consolidate Into a Single Canonical Function

Rather than patching more drift, **replace both overloads with a single function** that has the entity parameter as optional (defaulting to NULL = all entities). This eliminates the synchronization problem permanently.

**Single migration** that:

1. Drops both existing overloads
2. Creates one function: `calculate_payroll_for_period(p_period_id UUID, p_commit BOOLEAN DEFAULT FALSE, p_entity_id UUID DEFAULT NULL)` incorporating:
   - Correct TSS parameter keys with `/100` division and COALESCE defaults
   - Lunch deduction on OT, Sunday, and holiday hours
   - Holiday-absence exclusion
   - `period_employee_benefits` with fallback to `employee_benefits / 2`
   - Loan decrement on commit
   - `round()` on all intermediate calculations
   - Year passed to `calculate_annual_isr`
   - Correct snapshot column names matching the actual table schema
3. No frontend changes needed — the RPC call already passes 3 args

### Technical Details

The function signature stays compatible:
```sql
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(
  p_period_id UUID,
  p_commit BOOLEAN DEFAULT FALSE,
  p_entity_id UUID DEFAULT NULL
) RETURNS TABLE (...)
```

The RETURN TABLE columns will use the names from the current 3-arg version (which the frontend expects): `tss_deduction`, `isr_deduction`, `benefits`, `sunday_hours`, `holiday_hours`.

The `payroll_snapshots` INSERT will be verified against the actual table columns to prevent NULL mismatches.

