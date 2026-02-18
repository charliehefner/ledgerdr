

# IR-3 and IR-17 Report Generators

## What We're Building

Two new report cards inside the existing **TSS tab** (rename it to something like "Reportes Gubernamentales" or keep it as a broader reporting tab) that calculate and display the exact values needed to fill out the IR-3 and IR-17 forms on the DGII portal.

Since these forms are submitted online (not as file uploads), the reports will show summary tables with the totals organized by the form's sections, with a "Copy" button for easy entry into the DGII portal.

---

## IR-3: Retenciones de Asalariados

**Purpose**: Monthly total of ISR withheld from employee salaries.

**Data source**: Payroll periods and the ISR calculation logic already in `PayrollSummary.tsx`.

**Report output**:
- Period selector (month/year)
- Aggregate ISR withheld across the 2 payroll periods in that month
- Show per-employee breakdown: Name, Cedula, Salary, ISR Withheld
- Total ISR withheld (the value to enter in IR-3)
- Export to Excel for records

**Calculation**: Sum the ISR from both bi-monthly payroll periods (1-15 and 16-end) for the selected month. Reuses the existing `calculateAnnualISR` function and TSS rate (5.91%).

---

## IR-17: Otras Retenciones y Retribuciones Complementarias

**Purpose**: Monthly total of ISR retained from third-party payments + retribuciones complementarias tax.

**Data source**: 
- `transactions` table where `isr_retenido > 0` for the selected month (Section I: Retenciones a terceros)
- `employee_benefits` for retribuciones complementarias (Section II)

**Report output**:
- Period selector (month/year)
- **Section I - Retenciones por servicios**: List of transactions with ISR retention, grouped by type (alquileres 10%, honorarios 10%, etc.), with subtotals
- **Section II - Retribuciones Complementarias**: Employee benefits (phone, gas, bonuses) with 27% tax calculation using gross-up
- **Section III - ITBIS Retenido**: Sum of `itbis_retenido` from transactions
- Grand total to pay
- Export to Excel

---

## Technical Changes

| File | Change |
|---|---|
| `src/components/hr/TSSAutodeterminacionView.tsx` | Rename/restructure to be a container with sub-tabs or accordion sections for TSS AM, IR-3, and IR-17 |
| `src/components/hr/IR3ReportView.tsx` | **New** - IR-3 summary report component |
| `src/components/hr/IR17ReportView.tsx` | **New** - IR-17 summary report component |
| `src/pages/HumanResources.tsx` | No change needed (TSS tab already exists) |

### IR-3 Implementation

- Query `payroll_periods` for the two periods in the selected month
- Query `employee_timesheets` for those periods
- Reuse the ISR calculation logic from `PayrollSummary.tsx` (extract into a shared utility)
- Display a table: Employee | Cedula | Salario Cotizable | ISR Retenido
- Footer row with total ISR to declare

### IR-17 Implementation

- Query `transactions` for the selected month where `isr_retenido > 0` OR `itbis_retenido > 0`
- Group by retention type (alquileres, honorarios, otros)
- Query `employee_benefits` and calculate 27% retribuciones complementarias tax with gross-up formula: `benefit_amount / 0.73 * 0.27`
- Display in sections matching the IR-17 form layout

### Shared Utility Extraction

Extract the ISR calculation functions from `PayrollSummary.tsx` into a shared file `src/lib/payrollCalculations.ts` so both `PayrollSummary` and `IR3ReportView` can use them without duplication:
- `calculateAnnualISR()`
- ISR brackets constant
- TSS rate constant

---

## UI Layout

The TSS tab will show three cards stacked vertically (or as sub-tabs):
1. TSS Autodeterminacion Mensual (existing)
2. IR-3 Retenciones de Asalariados (new)
3. IR-17 Otras Retenciones (new)

Each card has its own month/year selector, summary table, and export button.

No database changes required -- all data already exists.

