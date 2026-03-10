

## Fix: Include Remaining Gallons When Resetting Tank Gauge

### Problem
When recording a diesel purchase with "Reset tank gauge" checked, the tank level is set to **only** the purchased amount, discarding whatever was remaining. Example: 70 gal remaining + 500 gal purchased → tank shows 500 instead of 570. Since the inventory trigger sums `current_level_gallons`, this means 70 gallons vanish from stock.

### Root Cause
In `PurchaseDialog.tsx` line 145:
```ts
newTankLevel = addedQuantity;  // ← discards remaining
```

### Fix (single file: `src/components/inventory/PurchaseDialog.tsx`)

1. **Line 145** — Change the tank level calculation to include remaining gallons:
   ```ts
   newTankLevel = Number(currentTank.current_level_gallons) + addedQuantity;
   ```

2. **Line 335** — Update the warning message to reflect the correct behavior:
   ```
   Tank level will be set to {remaining + purchased} gal and pump reading will reset to 0
   ```

The gauge reset (pump reading → 0) stays the same. Only the tank **level** calculation changes to preserve existing fuel.

### Data Fix
The already-recorded purchase likely needs a manual correction to add back the 70 missing gallons to the affected tank's `current_level_gallons`. This will be handled via a data update after code is fixed.

