

## Comprehensive Null-Safety Audit and Fix

### Audit Scope
Reviewed all data-rendering views across Fuel, Operations, HR, Inventory, and Transactions modules — every file that accesses joined/nullable database fields.

### Findings Summary

| Module | File | Status |
|--------|------|--------|
| Fuel — Agriculture | `AgricultureFuelView.tsx` | Fixed (previous change) |
| Fuel — Industry | `IndustryFuelView.tsx` | **2 issues found** |
| Fuel — Tank History | `TankHistoryView.tsx` | Safe (uses `!inner` + optional chaining) |
| Fuel — Tractor History | `TractorHistoryView.tsx` | **1 issue found** |
| Fuel — Equipment | `FuelEquipmentView.tsx` | Safe |
| Fuel — Implements | `ImplementsView.tsx` | Safe |
| Operations — Log | `OperationsLogView.tsx` | Safe (already uses `?.` everywhere) |
| Operations — Field History | `FieldHistoryPanel.tsx` | **1 issue found** |
| Operations — KML Import | `KMLImportDialog.tsx` | **1 issue found** |
| Operations — Fields Map | `FieldsMapView.tsx` | Safe |
| HR — Day Labor | `DayLaborView.tsx` | Safe |
| HR — Payroll | `PayrollSummary.tsx` | Safe (sorts on local data) |
| Inventory | `InventoryItemDialog.tsx` | Safe (already uses `?.`) |

### Issues to Fix

**1. IndustryFuelView.tsx — `fuel_tanks.name` unguarded in sort**
The sorting logic doesn't have a sort comparator at all (no sortable columns implemented), but the table rendering at line 620 and exports at lines 300/332 access `tx.fuel_tanks.name` without optional chaining. If a tank were deleted, this crashes.
- Fix: `tx.fuel_tanks?.name || "-"` in 3 locations (table render, Excel export, PDF export)

**2. TractorHistoryView.tsx — `hour_meter_reading.toFixed(1)` unguarded**
Line 325: `tx.hour_meter_reading.toFixed(1)` — the interface declares this as `number` (non-nullable), but the database column IS nullable. If a record has null, this crashes.
- Fix: `(tx.hour_meter_reading ?? 0).toFixed(1)` at line 325
- Also line 324: `tx.previous_hour_meter?.toFixed(1) || "0"` — already partially guarded but should use `?? 0` for consistency

**3. FieldHistoryPanel.tsx — Division by zero**
Line 202: `(op.hectares_done / (metrics.fieldMinutes / 60)).toFixed(2)` — if `metrics.fieldMinutes` is 0, this produces `Infinity` or `NaN`, rendering broken text.
- Fix: Add guard `metrics.fieldMinutes > 0` to the condition

**4. KMLImportDialog.tsx — `match.farms.name` unguarded**
Line 69: `farm_name: match.farms.name` — if a field has no farm association (orphaned data), `farms` could be null.
- Fix: `farm_name: match.farms?.name || "-"`

### Changes

4 files edited, 7 specific null guards added. No behavioral changes — only crash prevention.

