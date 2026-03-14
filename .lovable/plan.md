

## Plan: Stop Vacation Countdown for Terminated Employees

### Problem
When an employee is terminated (marked inactive), the vacation countdown continues calculating days as if they were still employed. Instead, it should show a stopped/discontinued state.

### Changes

**1. Database Migration — add `date_of_termination` to `employees`**
- `ALTER TABLE employees ADD COLUMN date_of_termination date NULL`
- Update `employees_safe` view to include the new column

**2. `EmployeeFormDialog.tsx` — termination date on deactivation**
- Add `date_of_termination` to schema (optional date field)
- When `is_active` is unchecked: show a date picker for termination date (defaults to today)
- When `is_active` is checked: clear `date_of_termination`
- On save with `is_active = false`: also deactivate all open employee loans (`UPDATE employee_loans SET is_active = false WHERE employee_id = ? AND is_active = true`)

**3. `EmployeeList.tsx` — show "Desvinculado" in vacation column for inactive employees**
- In the `vacations` case of `renderCellValue`: if `!employee.is_active`, render a neutral grey badge saying "Desvinculado" with a stop icon instead of running the countdown calculation
- The badge is not clickable (no vacation dialog opens for terminated employees)

**4. `EmployeeDetailDialog.tsx` — block new movements for inactive employees**
- Hide "Add Vacation", "Add Incident", and "Add Loan" buttons when employee is inactive
- Show an info banner: "Empleado desvinculado — no se permiten nuevos movimientos"

### Key distinction from previous plan
The vacation countdown is **stopped and discontinued** (showing a terminal "Desvinculado" state), not merely hidden. The employee row still appears in the directory with all historical data visible — only the countdown logic ceases and new entries are blocked.

