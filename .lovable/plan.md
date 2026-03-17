

# Fix: Tractor Hour Meters Still Being Overwritten

## Problem
The offline queue (`useOfflineQueue.ts`) was correctly fixed — it no longer updates `current_hour_meter`. However, **two other files still do**:

1. **`src/components/fuel/AgricultureFuelView.tsx`** (line 253-258) — directly updates `current_hour_meter` when recording a fuel transaction from the Agriculture Fuel tab.
2. **`src/components/fuel/IndustryFuelView.tsx`** (line 252-256) — same issue for generators/industry equipment.

The operations log DB trigger (`update_tractor_hour_meter`) is the canonical source, setting `current_hour_meter` to the MAX `end_hours` from the operations log. These fuel views overwrite it with potentially lower/stale values.

## Fix

### `src/components/fuel/AgricultureFuelView.tsx`
Remove lines 253-258 (the `supabase.from("fuel_equipment").update({ current_hour_meter })` block) and replace with the same comment used in useOfflineQueue.

### `src/components/fuel/IndustryFuelView.tsx`
**Keep this one** — generators are NOT managed by the operations log trigger (which only fires on tractors). Generators legitimately need their hour meters updated from fuel transactions since there's no other source.

## Second Issue
You mentioned "Two issues" but only described the hour meter sync problem. What is the second issue you'd like addressed?

