

## Feature: Cross-Tank Fuel Transfers

### Problem
When an agricultural mobile tank fuels an industrial tank (or vice versa), there's no way to record this. The system only supports `dispense` (to equipment) and `refill` (purchase). Tank-to-tank transfers across cost centers are not handled.

### Solution
Add a **"Tank Transfer"** transaction type that records fuel moving from one tank to another, updating both tank levels and inventory accordingly.

### Database Changes

1. **Alter `fuel_transactions` CHECK constraint** — add `'transfer'` to allowed `transaction_type` values
2. **Add `destination_tank_id` column** — nullable UUID referencing `fuel_tanks(id)`, used only for transfer transactions
3. **RLS** — existing policies cover this since transfers are admin-initiated

### UI Changes

**`src/components/fuel/FuelTanksView.tsx`** — Add a "Transfer Between Tanks" button and dialog:
- Source tank selector (any active tank)
- Destination tank selector (filtered to exclude source, any `use_type`)
- Gallons to transfer (validated against source tank level)
- Optional notes field
- On submit: insert `fuel_transaction` with `transaction_type = 'transfer'`, deduct from source tank's `current_level_gallons`, add to destination tank's `current_level_gallons`, and update both inventory items accordingly (deduct from source use_type inventory, add to destination use_type inventory)

**`src/components/fuel/AgricultureFuelView.tsx`** and **`IndustryFuelView.tsx`**:
- Add `'transfer'` to the `transaction_type` filter so transfers appear in both views' reports
- Display transfers with a distinct badge (e.g., orange "Transfer" badge)
- Show source/destination tank names instead of equipment name for transfer rows

### Files to Change

| File | Change |
|------|--------|
| Migration SQL | Add `transfer` to CHECK constraint, add `destination_tank_id` column |
| `src/components/fuel/FuelTanksView.tsx` | Add transfer dialog with source/destination tank pickers and gallons input |
| `src/components/fuel/AgricultureFuelView.tsx` | Include `transfer` in query filter, render transfer rows with badge |
| `src/components/fuel/IndustryFuelView.tsx` | Same as above |
| `src/components/fuel/TankHistoryView.tsx` | Show transfers in tank history |

