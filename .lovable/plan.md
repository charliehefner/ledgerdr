

## Fix: Correct Mobile Tank's Stale Pump Reading via Data Migration

### Problem
The Mobile tank received a 197.5-gallon transfer **before** the pump gauge fix was deployed. The automatic adjustment code is now in place (lines 162-164 of FuelTanksView.tsx), so all future transfers will correctly adjust the pump reading. However, the Mobile tank's `last_pump_end_reading` is still stale at 97.5 from the old transfer.

### Solution
Run a one-time database correction to recalculate the Mobile tank's `last_pump_end_reading` based on what it should have been after the 197.5-gallon transfer. No UI changes needed — the automatic logic is already correct for future transfers.

### Steps

1. **Query** the Mobile tank to get its current `last_pump_end_reading` and confirm the stale value
2. **Calculate** the corrected reading: `Math.max(0, 97.5 - 197.5) = 0` — the pump gauge should have reset to 0 after receiving that much fuel
3. **Update** the Mobile tank's `last_pump_end_reading` to the corrected value via a database query

This is a data-only fix. The code is already correct — no file changes required.

| Action | Detail |
|--------|--------|
| Database query | Update Mobile tank's `last_pump_end_reading` to corrected value |
| Code changes | None — automatic adjustment already deployed |

