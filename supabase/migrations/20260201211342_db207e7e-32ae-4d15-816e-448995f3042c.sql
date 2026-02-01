-- Create function to update tractor hour meter from operations
CREATE OR REPLACE FUNCTION public.update_tractor_hour_meter()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_hours NUMERIC;
BEGIN
  -- Only proceed if tractor_id and end_hours are set
  IF NEW.tractor_id IS NOT NULL AND NEW.end_hours IS NOT NULL THEN
    -- Get the maximum end_hours for this tractor from all operations
    SELECT COALESCE(MAX(end_hours), 0)
    INTO max_hours
    FROM operations
    WHERE tractor_id = NEW.tractor_id
      AND end_hours IS NOT NULL;
    
    -- Update the tractor's current_hour_meter if the new max is higher
    UPDATE fuel_equipment
    SET current_hour_meter = max_hours,
        updated_at = now()
    WHERE id = NEW.tractor_id
      AND current_hour_meter < max_hours;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on operations table
DROP TRIGGER IF EXISTS update_tractor_hour_meter_trigger ON operations;
CREATE TRIGGER update_tractor_hour_meter_trigger
AFTER INSERT OR UPDATE ON operations
FOR EACH ROW
EXECUTE FUNCTION public.update_tractor_hour_meter();

-- Also update existing tractors with their max hour meter from operations
UPDATE fuel_equipment fe
SET current_hour_meter = COALESCE(
  (SELECT MAX(end_hours) FROM operations WHERE tractor_id = fe.id AND end_hours IS NOT NULL),
  fe.current_hour_meter
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM operations WHERE tractor_id = fe.id AND end_hours IS NOT NULL
);