

# Fix: Hour Meter Trigger Doesn't Revert Old Tractor on Reassignment

## Problem
The `update_tractor_hour_meter()` trigger only recalculates hours for `NEW.tractor_id`. When someone saves an operation with the wrong tractor, then corrects it, the original tractor keeps the inflated value permanently. This has now happened three times.

## Root Cause (from data)
On March 18 at 20:39 UTC, an operation with `end_hours = 7137.1` was created under JD 7280R (whose true max is 5072.7). At 20:45 it was corrected to JD3006 — but JD 7280R was never recalculated.

## Plan

### 1. Replace the trigger function (migration)
Rewrite `update_tractor_hour_meter()` to handle all cases:
- **INSERT**: recalculate `NEW.tractor_id`
- **UPDATE where tractor changed**: recalculate BOTH `OLD.tractor_id` and `NEW.tractor_id`
- **UPDATE same tractor**: recalculate `NEW.tractor_id`
- **DELETE**: recalculate `OLD.tractor_id`

Each recalculation uses `MAX(end_hours)` from operations for that tractor (not just "update if higher").

Update the trigger to fire on INSERT, UPDATE, **and DELETE**.

### 2. Add hour-gap validation trigger (migration)
Create a `validate_operation_hour_gap()` trigger that **blocks** saves when the gap between the tractor's last `end_hours` and the new `start_hours` exceeds 100 hours. This prevents wrong-tractor entries at the source.

### 3. Data repair (same migration)
One-time UPDATE to set every tractor's `current_hour_meter = MAX(operations.end_hours)`, fixing JD 7280R (7137.1 → 5072.7) and any other silently corrupted tractors.

### 4. Frontend: hard-block on large gap (OperationsLogView.tsx)
Change the existing gap warning to a blocking error — prevent form submission when gap > 100h, showing a message like "Hour gap too large (2064h). Check tractor selection."

### 5. Frontend: read-only hour meter (TractorsView.tsx)
Make the `current_hour_meter` field read-only in edit mode with a label "Calculated from operations" to prevent manual overrides.

## Technical Detail

**Migration SQL (key parts):**
```sql
-- Rewritten trigger function
CREATE OR REPLACE FUNCTION update_tractor_hour_meter()
RETURNS trigger AS $$
DECLARE max_h NUMERIC;
BEGIN
  -- Recalc NEW tractor
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.tractor_id IS NOT NULL THEN
    SELECT COALESCE(MAX(end_hours), 0) INTO max_h
    FROM operations WHERE tractor_id = NEW.tractor_id AND end_hours IS NOT NULL;
    UPDATE fuel_equipment SET current_hour_meter = max_h WHERE id = NEW.tractor_id;
  END IF;
  -- Recalc OLD tractor if changed or deleted
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.tractor_id IS DISTINCT FROM NEW.tractor_id))
     AND OLD.tractor_id IS NOT NULL THEN
    SELECT COALESCE(MAX(end_hours), 0) INTO max_h
    FROM operations WHERE tractor_id = OLD.tractor_id AND end_hours IS NOT NULL;
    UPDATE fuel_equipment SET current_hour_meter = max_h WHERE id = OLD.tractor_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

-- Recreate trigger with DELETE
DROP TRIGGER IF EXISTS update_tractor_hour_meter_trigger ON operations;
CREATE TRIGGER update_tractor_hour_meter_trigger
  AFTER INSERT OR UPDATE OR DELETE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_tractor_hour_meter();

-- Validation trigger (block >100h gaps)
-- Data repair for all tractors
```

**Files to modify:**
- New migration file (trigger rewrite + validation + data repair)
- `src/components/operations/OperationsLogView.tsx` (hard-block submit)
- `src/components/fuel/TractorsView.tsx` (read-only hour meter)

