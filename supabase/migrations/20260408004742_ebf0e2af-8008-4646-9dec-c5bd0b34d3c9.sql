
-- Make the trigger function SECURITY DEFINER so it bypasses RLS
-- This ensures hour meter updates work regardless of the user's role
CREATE OR REPLACE FUNCTION update_tractor_hour_meter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_h NUMERIC;
BEGIN
  -- Recalculate NEW tractor on INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.tractor_id IS NOT NULL THEN
    SELECT COALESCE(end_hours, 0) INTO latest_h
    FROM operations
    WHERE tractor_id = NEW.tractor_id AND end_hours IS NOT NULL
    ORDER BY operation_date DESC, end_hours DESC
    LIMIT 1;

    UPDATE fuel_equipment
    SET current_hour_meter = COALESCE(latest_h, 0), updated_at = now()
    WHERE id = NEW.tractor_id;
  END IF;

  -- Recalculate OLD tractor if tractor changed or row deleted
  IF (TG_OP = 'DELETE' AND OLD.tractor_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.tractor_id IS DISTINCT FROM NEW.tractor_id AND OLD.tractor_id IS NOT NULL) THEN
    SELECT COALESCE(end_hours, 0) INTO latest_h
    FROM operations
    WHERE tractor_id = OLD.tractor_id AND end_hours IS NOT NULL
    ORDER BY operation_date DESC, end_hours DESC
    LIMIT 1;

    UPDATE fuel_equipment
    SET current_hour_meter = COALESCE(latest_h, 0), updated_at = now()
    WHERE id = OLD.tractor_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix currently stale hour meters by recalculating from operations
UPDATE fuel_equipment fe
SET current_hour_meter = sub.latest_end_hours, updated_at = now()
FROM (
  SELECT DISTINCT ON (tractor_id) tractor_id, end_hours AS latest_end_hours
  FROM operations
  WHERE end_hours IS NOT NULL
  ORDER BY tractor_id, operation_date DESC, end_hours DESC
) sub
WHERE fe.id = sub.tractor_id
AND fe.current_hour_meter IS DISTINCT FROM sub.latest_end_hours;
