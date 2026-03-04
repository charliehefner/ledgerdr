

## Two Payroll Adjustments

### 1. Reorder columns: Ausencias before TSS/ISR

Currently the table column order is: Salario Base → Pago Neto → Beneficios → Préstamo → **TSS** → **ISR** → **Ausencias** → Hrs...

The correct order should be: Salario Base → Pago Neto → Beneficios → Préstamo → **Ausencias** → **TSS** → **ISR** → Hrs...

This affects three places in `PayrollSummary.tsx`:
- **Table header** (lines 869-884): Move `Ausencias` column before `TSS`
- **Table body** (lines 887-933): Move absence cell before TSS/ISR cells
- **Table footer** (lines 935-981): Same reorder in totals row
- **Excel export** (lines 530-545): Reorder columns so Ausencias comes before TSS/ISR
- **PDF export** (lines 638-641): Reorder headers array

### 2. Monthly consolidated Excel export

Add a new export option "Exportar Mes Completo" that:
- Fetches **both payroll periods** for the current month (1-15 and 16-end)
- Pulls snapshot data from `payroll_snapshots` joined with employees
- **Sums** each employee's values across the two periods (base pay, overtime, benefits, deductions, net pay)
- Exports a single Excel file with one row per employee showing monthly totals
- Filename: `Nomina_Mensual_YYYY-MM.xlsx`

This will be added as a third item in the existing Export dropdown menu in `PayrollSummary.tsx`.

### Files Modified
- `src/components/hr/PayrollSummary.tsx` — column reorder + new monthly export function

