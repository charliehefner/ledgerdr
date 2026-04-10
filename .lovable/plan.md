

# Fix: Trigger not updating pump end reading on dispense

## Problem
The newly created `trg_adjust_tank_level` trigger correctly adjusts `current_level_gallons` but does **not** update `last_pump_end_reading` on dispense transactions. The Pala Volvo operation (Apr 9) recorded `pump_end_reading = 100.4`, but the Mobile tank still shows `48.8`.

## Root Cause
When we created the trigger in the last migration, we only included level adjustments and omitted the pump reading update that the client-side code previously handled. The offline queue (`useOfflineQueue.ts`) does update it for portal submissions, but the Agriculture dispense form no longer does (it was removed to avoid double-counting).

## Fix

### 1. Update the database trigger
Create a migration that replaces the `adjust_tank_level_on_fuel_tx()` function to also set `last_pump_end_reading = NEW.pump_end_reading` when `transaction_type = 'dispense'` and `NEW.pump_end_reading IS NOT NULL`.

### 2. Correct current data
In the same migration, update Mobile tank's `last_pump_end_reading` to `100.4` (the actual pump end from the last dispense).

### 3. Remove redundant client-side pump update from offline queue
Since the trigger now handles pump readings, remove the manual `last_pump_end_reading` update in `useOfflineQueue.ts` (lines 129-134) to avoid double writes.

### Technical Details

**Migration SQL:**
```sql
CREATE OR REPLACE FUNCTION public.adjust_tank_level_on_fuel_tx()
RETURNS TRIGGER ...
AS $$
BEGIN
  IF NEW.transaction_type = 'dispense' THEN
    UPDATE fuel_tanks
       SET current_level_gallons = GREATEST(0, current_level_gallons - NEW.gallons),
           last_pump_end_reading = COALESCE(NEW.pump_end_reading, last_pump_end_reading),
           updated_at = now()
     WHERE id = NEW.tank_id;
  -- ... refill and transfer unchanged
  END IF;
  RETURN NEW;
END;
$$;

-- Fix current data
UPDATE fuel_tanks SET last_pump_end_reading = 100.4 WHERE name ILIKE '%mobile%';
```

**useOfflineQueue.ts:** Remove the manual `fuel_tanks.update({ last_pump_end_reading })` call since the trigger now handles it.

