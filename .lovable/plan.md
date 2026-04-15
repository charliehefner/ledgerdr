

## Fix: Round All Inventory Item Quantities in Database

### Problem
Several inventory items have floating-point drift in their `current_quantity` values stored in the database:

| Item | Current DB Value | Should Be |
|------|-----------------|-----------|
| Diesel Agrícola | 283.29999999999999 | 283.30 |
| Diesel Industrial | 298.50000000000006 | 298.50 |
| Pledge 51 WG | 1.0799999999999996 | 1.08 |

The UI uses `.toFixed(2)` so most display is fine, but the underlying data should be clean. Additionally, the `PurchaseDialog` and `StockAdjustmentDialog` perform arithmetic without rounding, which can reintroduce drift.

### Plan

**1. Data fix (SQL migration)**
Round all `current_quantity` values in `inventory_items` to 4 decimal places:
```sql
UPDATE inventory_items SET current_quantity = ROUND(current_quantity::numeric, 4);
```

**2. Code fixes — add ROUND to client-side stock arithmetic**
- `PurchaseDialog.tsx` (line ~169): Wrap `newQuantity` in `Math.round(... * 10000) / 10000`
- `StockAdjustmentDialog.tsx` (lines ~51-55): Same rounding for add/subtract/set cases

This ensures all three stock mutation paths (operations via DB function, purchases, manual adjustments) consistently round to 4 decimals.

### Scope
| Component | Change |
|-----------|--------|
| SQL migration | Round all current_quantity values |
| PurchaseDialog.tsx | Add rounding to purchase stock update |
| StockAdjustmentDialog.tsx | Add rounding to adjustment stock update |

