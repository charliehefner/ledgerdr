

## Fix: "column reference employee_id is ambiguous"

### Root Cause

The unified `calculate_payroll_for_period` function declares `employee_id UUID` in its `RETURNS TABLE(...)`. This creates a PL/pgSQL variable named `employee_id`. When SQL statements inside the function reference `employee_id` without a table alias, PostgreSQL cannot tell whether you mean the table column or the output variable.

### Affected Locations (6 places)

| Line | Context | Fix |
|------|---------|-----|
| 146 | `ts.employee_id` | Already aliased — OK |
| 159 | `WHERE ... employee_id = v_emp.id` (period_employee_benefits) | Add alias `peb.employee_id` |
| 164 | `WHERE employee_id = v_emp.id` (employee_benefits) | Add alias `eb.employee_id` |
| 189 | `WHERE employee_id = v_emp.id` (employee_loans) | Add alias `el.employee_id` |
| 229 | `WHERE employee_id = v_emp.id` (employee_loans UPDATE) | Add alias `employee_loans.employee_id` |

### Fix

Single migration that recreates the function with table aliases on all `employee_id` references:

```sql
-- period_employee_benefits
FROM period_employee_benefits peb
WHERE peb.period_id = p_period_id AND peb.employee_id = v_emp.id;

-- employee_benefits
FROM employee_benefits eb
WHERE eb.employee_id = v_emp.id AND eb.is_recurring = true AND eb.amount > 0;

-- employee_loans (SELECT)
FROM employee_loans el
WHERE el.employee_id = v_emp.id AND el.is_active = true AND el.remaining_payments > 0;

-- employee_loans (UPDATE)
UPDATE employee_loans
SET ...
WHERE employee_loans.employee_id = v_emp.id AND employee_loans.is_active = true ...
```

Also alias `period_id` in the same queries since it's also declared in `RETURNS TABLE` — though it doesn't appear to be declared there in this version, it's good practice to fully qualify all column references.

No frontend changes needed.

