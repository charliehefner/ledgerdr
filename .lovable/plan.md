
# Plan: Add Sunday Pay Columns to Payroll Summary Table

## Overview
The Sunday hours and pay are calculated correctly and exported to Excel, but the columns are missing from the **Resumen de Nómina** (Payroll Summary) table in the UI. We need to add these columns to match the Time Grid ("Hoja de Tiempo") which already shows Sunday hours.

## Changes Required

### File: `src/components/hr/PayrollSummary.tsx`

**1. Add Sunday Hours Column Header (after Holiday Hours)**
- Add a new `<TableHead>` for "Hrs Dom" with emerald-700 color styling (matching the Time Grid)

**2. Add Sunday Pay Column Header (after Holiday Pay)**
- Add a new `<TableHead>` for "Pago Dom" with emerald-700 color styling

**3. Add Sunday Hours Data Cells (employee rows)**
- Display `p.sundayHours` in the employee row, showing "-" when zero

**4. Add Sunday Pay Data Cells (employee rows)**
- Display `p.sundayPay` formatted as currency, showing "-" when zero

**5. Add Sunday Totals (footer row)**
- Display `totals.sundayHours` and `totals.sundayPay` in the footer totals

## Updated Column Order
| Empleado | Pago Neto | Hrs Reg | Hrs Extra | Hrs Fer | **Hrs Dom** | Salario Base | Pago Extra | Pago Fer | **Pago Dom** | Beneficios | Préstamo | TSS | ISR |

---

## Technical Details

The data is already available in the `payrollData` array and `totals` object:
- `p.sundayHours` / `totals.sundayHours` - already calculated
- `p.sundayPay` / `totals.sundayPay` - already calculated

No calculation logic changes needed—this is purely a UI display fix.

## Styling
- Color: `text-emerald-700` (matching the "Dom" column in PayrollTimeGrid)
- Format: Hours as `X.X`, Pay as currency with `formatCurrency()`
- Show "-" when value is 0 (consistent with Holiday columns)
