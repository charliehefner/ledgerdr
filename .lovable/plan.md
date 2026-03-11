

## Rendering Audit: Null-Safety Fixes Across Fuel and Operations

### Problems Found

After reviewing all rendering code, I identified several places where data access on nullable fields can crash (TypeError: cannot read property of null/undefined), causing boxes or rows to not render:

**1. AgricultureFuelView — Sorting crashes on null `fuel_equipment`**
- Lines 537-538: `a.fuel_equipment.name.localeCompare(b.fuel_equipment.name)` — when sorting by tractor, refill transactions have `fuel_equipment: null`, causing a crash.
- Lines 541-544: Same for `hour_meter_reading`, `pump_start_reading`, `pump_end_reading` — these are nullable but accessed directly without null guards in the sort comparator.
- Lines 606-613 in Excel export: `tx.fuel_equipment.name` crashes for refills.
- Lines 659-668 in PDF export: Same issue — `tx.fuel_equipment.name` and `.toString()` on nullable readings.

**2. AgricultureFuelView — Edit dialog null crash**
- Lines 431-434: `handleEdit` calls `.toString()` on `pump_start_reading`, `pump_end_reading`, `hour_meter_reading` without null checks. If any are null, it crashes.

**3. AgricultureFuelView — Edit dialog header**
- Line 1104: `editingTransaction.fuel_equipment.name` crashes if `fuel_equipment` is null (refill row).

### Fixes (1 file: `src/components/fuel/AgricultureFuelView.tsx`)

1. **Sort comparator** (lines 537-544): Add null guards:
   - `(a.fuel_equipment?.name || "").localeCompare(b.fuel_equipment?.name || "")`
   - `(a.hour_meter_reading ?? 0) - (b.hour_meter_reading ?? 0)`
   - `(a.pump_start_reading ?? 0) - (b.pump_start_reading ?? 0)`
   - `(a.pump_end_reading ?? 0) - (b.pump_end_reading ?? 0)`

2. **Excel export** (line 608): `tx.fuel_equipment?.name || "-"`

3. **PDF export** (line 662): `tx.fuel_equipment?.name || "-"`, and use `?.toString() || "-"` for nullable readings.

4. **handleEdit** (lines 431-434): Guard with `?? ""`:
   - `pump_start_reading: tx.pump_start_reading?.toString() ?? ""`
   - Same for `pump_end_reading` and `hour_meter_reading`

5. **Edit dialog header** (line 1104): `editingTransaction.fuel_equipment?.name || "-"`

### Operations Log — Already Safe
The OperationsLogView table rendering already uses optional chaining (`op.fields?.name`, `op.fuel_equipment?.name`, etc.) and the sort comparator uses fallback values. No fixes needed.

### Scope
Single file edit: `src/components/fuel/AgricultureFuelView.tsx` — 5 targeted null-safety fixes.

