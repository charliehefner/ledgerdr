## Problem

Office role can open the Payroll timesheet, but RLS blocks her writes to `employee_timesheets` and `payroll_periods`. UI permissions already allow office; only the database is rejecting.

## Fix

One migration adding `office` write policies, scoped by `entity_id` via `has_role_for_entity`:

1. **`employee_timesheets`** — FOR ALL (insert/update/delete) so office can enter start/end times, mark absent/holiday, clear cells.
2. **`payroll_periods`** — FOR ALL so office can click "Create period" on a new fortnight.

Pattern (matches existing entity-scoped policies):
```sql
CREATE POLICY "entity_office_employee_timesheets"
ON public.employee_timesheets FOR ALL
TO authenticated
USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "entity_office_payroll_periods"
ON public.payroll_periods FOR ALL
TO authenticated
USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));
```

## Out of scope

- No write policies for `employee_benefits` or `employee_vacations`.
- No UI changes (`permissions.ts` already allows office).
- No change to period close/lock logic — existing triggers still guard locked periods.

## Verification

Login as Ana (office) → Payroll → enter a start/end time → saves; click "Create period" on an unopened fortnight → succeeds.
