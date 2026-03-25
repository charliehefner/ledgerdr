

## Plan: Admin Pump Gauge Reset

### Problem
When a supervisor or driver physically resets a tank's pump gauge (e.g., to zero), there's no way in the UI to update the stored `last_pump_end_reading` value. Currently this requires direct database intervention.

### Solution
Add a **"Reset Pump Gauge"** button on the **Fuel Tanks** view, visible only to admin/management users. Clicking it opens a small dialog where the admin selects a tank and enters the new gauge value (defaulting to 0). This directly updates `last_pump_end_reading` in the database.

### Changes

**1. `src/components/fuel/FuelTanksView.tsx`**
- Add a "Reset Gauge" action button (with a `RotateCcw` icon) on each tank row, visible only to admin/management users
- Clicking opens a confirmation dialog with:
  - Tank name (read-only)
  - Current gauge reading (read-only)
  - New gauge value input (defaults to 0)
  - Reason/notes field (optional, for audit trail)
- On confirm: updates `last_pump_end_reading` on the `fuel_tanks` table and invalidates queries

**2. Keep the existing wizard override as-is**
- The tolerance bypass in the Fueling Wizard remains useful — it handles cases where the reading legitimately differs but doesn't need a full reset (e.g., slight mechanical drift)

### What stays the same
- The existing ±0.2 tolerance validation in the wizard
- The "Reset tank gauge" checkbox in PurchaseDialog (for purchase-time resets)
- All other pump reading automation

