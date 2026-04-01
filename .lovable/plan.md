
Goal: add a prestaciones-focused employment summary in Human Resources and implement an official-style Prestaciones Laborales calculator for the selected scenarios: Desahucio and Dimisión, using average salary history by default and producing a printable breakdown.

What I found
- The HR module already has most of the base data:
  - `employees.date_of_hire`
  - `employees.date_of_termination`
  - `employee_salary_history`
  - vacations, loans, payroll snapshots
- The employee detail dialog already shows salary history, but not:
  - months at each salary level
  - a prestaciones summary
  - a liquidation calculator
- There is no prestaciones/liquidation logic in the codebase today.

Recommended product design
- Keep the Employee Directory table compact.
- Add a new “Resumen laboral / Prestaciones” section inside `EmployeeDetailDialog` opened from Employee Directory.
- Add a dedicated “Calcular Prestaciones” action there, with printable output.

Implementation plan
1. Enhance the employee employment summary
- Extend the employee detail view to show:
  - hire date
  - termination/end date
  - total tenure
  - salary history timeline
  - months at each salary level
- Compute each salary segment from `employee_salary_history.effective_date` until the next change or termination/current date.

2. Add a prestaciones calculator workflow
- Add a new calculator panel/dialog from Employee Detail.
- Inputs:
  - termination date
  - termination scenario (`desahucio`, `dimisión`)
  - whether notice was worked/paid
  - optional manual adjustments/deductions
- Output:
  - average salary basis
  - preaviso (when applicable)
  - cesantía (when applicable)
  - vacaciones pendientes
  - regalía pascual proporcional
  - deductions / net total
  - printable summary

3. Move calculation rules to the backend
- Implement the prestaciones formulas in a database function/RPC, not only in React.
- Reason:
  - auditability
  - consistent results
  - easier future legal updates
- Make legal constants configurable in a small parameters table instead of hardcoding everything.

4. Add persistence for liquidation cases
- Create a table for saved prestaciones calculations/history, e.g.:
  - employee
  - scenario
  - termination date
  - salary basis used
  - line-item results
  - notes / overrides
  - created_by / created_at
- This allows printing, review, and later correction without recalculating blindly.

5. Add printable report
- Generate an internal liquidation summary that mirrors the official-style breakdown:
  - employee identity
  - employment dates
  - salary periods and months
  - calculation basis
  - each prestaciones concept
  - total payable
- Make it printable/exportable from the saved calculation.

Additional information needed for accurate prestaciones
For a reliable “official-style” calculation, the app should capture or confirm these items:
- termination cause/scenario: already scoped to Desahucio and Dimisión first
- exact termination effective date
- whether preaviso was worked or must be paid
- whether unused vacation days should be system-calculated or manually adjusted
- recurring variable pay that should affect the average salary basis:
  - overtime
  - commissions
  - incentives/ordinary recurring benefits
- active employee loans or other authorized deductions to subtract from the final settlement
- months worked in the current year for regalía proporcional
- any manual legal adjustment required for edge cases

Important design note
- “Official-style” is achievable, but it should be implemented as:
  - rule-based
  - parameterized
  - reviewable/printable
- That is safer than burying formulas only in the UI, and it makes future legal changes easier.

Technical details
- Main UI files likely involved:
  - `src/components/hr/EmployeeDetailDialog.tsx`
  - `src/components/hr/EmployeeList.tsx`
  - possibly a new `PrestacionesCalculatorDialog.tsx` or similar
- Backend additions likely needed:
  - parameters table for prestaciones rules
  - liquidation cases table
  - database function to calculate prestaciones
  - RLS policies aligned with current HR access (`admin`, `management`, `accountant`)
- Existing data already useful:
  - `employee_salary_history`
  - `employees.date_of_hire`
  - `employees.date_of_termination`
  - `employee_vacations`
  - `employee_loans`
  - `payroll_snapshots`

Expected first version
- Employee Directory detail view shows a clean employment summary with salary-duration breakdown.
- HR can calculate prestaciones for Desahucio and Dimisión.
- The calculator uses average salary history by default.
- The result is saved and printable with line-by-line concepts such as cesantía and related items where applicable.
