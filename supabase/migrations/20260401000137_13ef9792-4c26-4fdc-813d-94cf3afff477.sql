
-- Fix: update_tractor_hour_meter trigger should use the LATEST operation's end_hours
-- (by operation_date DESC, end_hours DESC) instead of MAX(end_hours).
-- This is critical when hour meters are reset (e.g., new hardware installed).

CREATE OR REPLACE FUNCTION public.update_tractor_hour_meter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix Landini's current_hour_meter to reflect the latest operation (6.4, not 2036.3)
UPDATE fuel_equipment
SET current_hour_meter = 6.4, updated_at = now()
WHERE id = 'c2de1bf0-5a56-44ea-b9b2-d20b07c43025';
