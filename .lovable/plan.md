

# Complete IR-3 Report Solution

## Problem

The current IR-3 report has significant accuracy issues:

1. **Month/year selectors are decorative** -- the report always calculates ISR from current salary and current benefits, regardless of the selected month
2. **No historical data** -- ISR amounts are never persisted when payroll is closed, so there is no way to know what was actually withheld in a past period
3. **Missing data structure** -- there is no table to store the ISR (and other deduction amounts) calculated at payroll close time

## Solution: Two-Part Approach

### Part 1: New `payroll_snapshots` table (persist ISR at close time)

Create a table that captures each employee's calculated payroll results when a period is closed. This ensures the IR-3 (and future reports) reflect what was *actually* withheld, not a recalculation.

**New table: `payroll_snapshots`**

| Column | Type | Description |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| period_id | uuid (FK) | Links to payroll_periods |
| employee_id | uuid (FK) | Links to employees |
| base_pay | numeric | Bi-weekly base pay |
| overtime_pay | numeric | Overtime earnings |
| holiday_pay | numeric | Holiday bonus |
| sunday_pay | numeric | Sunday bonus |
| total_benefits | numeric | Sum of benefits |
| tss | numeric | TSS deduction |
| isr | numeric | ISR withheld (key field for IR-3) |
| loan_deduction | numeric | Loan installment |
| absence_deduction | numeric | Absence deduction |
| vacation_deduction | numeric | Vacation deduction |
| gross_pay | numeric | Total gross |
| net_pay | numeric | Net paid |
| created_at | timestamptz | Record timestamp |

Unique constraint on (period_id, employee_id) to prevent duplicates.

RLS policies will mirror the payroll_periods table (Admin/Management full access, Accountant read).

### Part 2: Populate snapshots at payroll close + update IR-3

**A. Modify PayrollSummary close logic** to insert snapshot rows for every employee when a period is closed.

**B. Rewrite IR-3 report** to:
- Find the two payroll periods whose date range falls within the selected month/year
- Pull ISR from `payroll_snapshots` for those closed periods
- For open (current) periods, fall back to the existing calculation
- Show per-employee breakdown with actual withheld amounts
- Display monthly total (sum of both bi-monthly periods)

### Part 3: Backfill existing closed periods

For the already-closed periods (e.g., Jan 1-15, Jan 16-31, Feb 1-15), we will recalculate and insert snapshot rows so historical IR-3 reports work immediately. This will be done via a one-time backfill triggered by a button in the IR-3 view (visible to Admin/Management only).

## Data Gap Advisory

**No missing columns in existing tables.** All the data needed to calculate payroll (timesheets, benefits, loans, vacations) already exists. The only missing piece is the *persistence of results*, which the new `payroll_snapshots` table solves.

One minor note: the `employee_benefits` table stores current/ongoing benefits but is not period-specific. The system already has `period_employee_benefits` for period-locked benefit amounts, but the current PayrollSummary reads from `employee_benefits` (the live table). This means benefit changes retroactively affect recalculations. The snapshot table solves this by capturing the actual amounts at close time.

## Files to Create/Modify

| File | Change |
|---|---|
| New migration | Create `payroll_snapshots` table with RLS |
| `src/components/hr/PayrollSummary.tsx` | Insert snapshot rows on period close |
| `src/components/hr/IR3ReportView.tsx` | Rewrite to query snapshots by month, add backfill button |
| `src/contexts/LanguageContext.tsx` | Update help.ir3 tooltip text |

## IR-3 Report New UI

The updated IR-3 will show:

```text
+----------------------------------------------------------+
| IR-3 -- Retenciones de Asalariados                       |
| [Month picker] [Year picker] [Copy Total] [Export Excel] |
|                                                          |
| Period: Feb 1-15 (closed) + Feb 16-28 (open/calculated)  |
|                                                          |
| Cedula | Nombre | Salario | ISR Q1 | ISR Q2 | ISR Mes  |
| -------|--------|---------|--------|--------|--------- |
| 001-.. | Juan   | 50,000  | 1,200  | 1,200  | 2,400   |
| 002-.. | Maria  | 35,000  |   450  |   450  |   900   |
|        |        |         |        | TOTAL  | 3,300   |
+----------------------------------------------------------+
```

- Q1 and Q2 columns show the ISR from each bi-monthly period
- Closed periods pull from snapshots; open periods show calculated estimates
- A badge indicates whether values are "actual" (from snapshot) or "estimated" (calculated)

## Technical Notes

- The snapshot insert happens inside the existing `closePeriod` mutation in PayrollSummary, using a batch upsert
- The backfill button recalculates payroll for each closed period using the same `calculateEmployeePayroll` logic, then inserts snapshots
- Excel export will include both Q1/Q2 columns plus the monthly total
- The `payroll_snapshots` table is append-only; corrections require reopening and reclosing a period

