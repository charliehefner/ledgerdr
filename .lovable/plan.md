

## Problem

The Input Usage Report shows **$0 cost for diesel** because on lines 298 and 327 of `InputUsageReport.tsx`, `costPerUnit` is hardcoded to `0` with a TODO comment. The `costPerUnitMap` already has diesel pricing from `inventory_purchases` (Diesel Agrícola has purchases at RD$224 and RD$242.10 per gallon), but this map is never used for diesel rows.

## Fix

In `src/components/operations/InputUsageReport.tsx`, replace the hardcoded `costPerUnit: 0` with the weighted average cost from `costPerUnitMap` using the Diesel Agrícola inventory item ID.

### Changes

1. **Look up diesel inventory item ID** — in the `dieselUsageRows` memo, find the diesel item from `inventoryItems` where `function === 'fuel'` to get its ID, then use `costPerUnitMap.get(dieselItemId) ?? 0` for `costPerUnit`.

2. **Line 298** (no-operation diesel rows): change `costPerUnit: 0` → `costPerUnit: dieselCostPerUnit`

3. **Line 327** (matched operation diesel rows): change `costPerUnit: 0` → `costPerUnit: dieselCostPerUnit`

4. **Add `costPerUnitMap` and `inventoryItems` to the `dieselUsageRows` dependency array** (they're already available in scope).

This is a ~5-line change. No database modifications needed — the purchase data already exists.

