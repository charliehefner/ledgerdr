-- 1. Rewrite the trigger function to handle INSERT, UPDATE (tractor change), and DELETE
CREATE OR REPLACE FUNCTION public.update_tractor_hour_meter()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  max_h NUMERIC;
BEGIN
  -- Recalculate NEW tractor on INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.tractor_id IS NOT NULL THEN
    SELECT COALESCE(MAX(end_hours), 0) INTO max_h
    FROM operations
    WHERE tractor_id = NEW.tractor_id AND end_hours IS NOT NULL;

    UPDATE fuel_equipment
    SET current_hour_meter = max_h, updated_at = now()
    WHERE id = NEW.tractor_id;
  END IF;

  -- Recalculate OLD tractor if tractor changed or row deleted
  IF (TG_OP = 'DELETE' AND OLD.tractor_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.tractor_id IS DISTINCT FROM NEW.tractor_id AND OLD.tractor_id IS NOT NULL) THEN
    SELECT COALESCE(MAX(end_hours), 0) INTO max_h
    FROM operations
    WHERE tractor_id = OLD.tractor_id AND end_hours IS NOT NULL;

    UPDATE fuel_equipment
    SET current_hour_meter = max_h, updated_at = now()
    WHERE id = OLD.tractor_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Recreate trigger to fire on INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS update_tractor_hour_meter_trigger ON operations;
CREATE TRIGGER update_tractor_hour_meter_trigger
  AFTER INSERT OR UPDATE OR DELETE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_tractor_hour_meter();

-- 3. Add validation trigger to block >100h hour gaps
CREATE OR REPLACE FUNCTION public.validate_operation_hour_gap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_end NUMERIC;
  v_gap NUMERIC;
BEGIN
  -- Only validate mechanical operations with start_hours and tractor
  IF NEW.tractor_id IS NULL OR NEW.start_hours IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the latest end_hours for this tractor (excluding current row on UPDATE)
  SELECT MAX(end_hours) INTO v_last_end
  FROM operations
  WHERE tractor_id = NEW.tractor_id
    AND end_hours IS NOT NULL
    AND (TG_OP = 'INSERT' OR id != NEW.id);

  -- If there is a previous operation, check the gap
  IF v_last_end IS NOT NULL THEN
    v_gap := NEW.start_hours - v_last_end;
    IF v_gap > 100 THEN
      RAISE EXCEPTION 'Salto de horometro demasiado grande (% hrs). Ultimo registro: %, inicio ingresado: %. Verifique el tractor seleccionado.',
        ROUND(v_gap, 1), ROUND(v_last_end, 1), ROUND(NEW.start_hours, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_operation_hour_gap_trigger ON operations;
CREATE TRIGGER validate_operation_hour_gap_trigger
  BEFORE INSERT OR UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION validate_operation_hour_gap();

-- 4. Data repair: reset all tractor hour meters to true MAX(operations.end_hours)
UPDATE fuel_equipment fe
SET current_hour_meter = sub.max_hours,
    updated_at = now()
FROM (
  SELECT tractor_id, COALESCE(MAX(end_hours), 0) AS max_hours
  FROM operations
  WHERE tractor_id IS NOT NULL AND end_hours IS NOT NULL
  GROUP BY tractor_id
) sub
WHERE fe.id = sub.tractor_id
  AND fe.equipment_type = 'tractor'
  AND fe.current_hour_meter != sub.max_hours;