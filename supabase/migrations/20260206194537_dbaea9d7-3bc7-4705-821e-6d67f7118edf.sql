-- Create function to sync fuel tank levels to inventory
CREATE OR REPLACE FUNCTION public.sync_fuel_tanks_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_use_type TEXT;
  v_total_level NUMERIC;
  v_inventory_name TEXT;
BEGIN
  -- Determine which use_type was affected
  IF TG_OP = 'DELETE' THEN
    v_use_type := OLD.use_type;
  ELSE
    v_use_type := NEW.use_type;
  END IF;
  
  -- Calculate total level for this use_type
  SELECT COALESCE(SUM(current_level_gallons), 0)
  INTO v_total_level
  FROM fuel_tanks
  WHERE use_type = v_use_type
    AND is_active = true
    AND fuel_type = 'diesel';
  
  -- Map use_type to inventory item name
  IF v_use_type = 'agriculture' THEN
    v_inventory_name := 'Diesel Agrícola';
  ELSIF v_use_type = 'industry' THEN
    v_inventory_name := 'Diesel Industrial';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Update the corresponding inventory item
  UPDATE inventory_items
  SET current_quantity = v_total_level,
      updated_at = now()
  WHERE commercial_name = v_inventory_name
    AND function = 'fuel';
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger on fuel_tanks table
CREATE TRIGGER sync_fuel_tanks_to_inventory_trigger
AFTER INSERT OR UPDATE OF current_level_gallons, use_type, is_active OR DELETE
ON fuel_tanks
FOR EACH ROW
EXECUTE FUNCTION sync_fuel_tanks_to_inventory();

-- Run initial sync for both use types
UPDATE inventory_items
SET current_quantity = (
  SELECT COALESCE(SUM(current_level_gallons), 0)
  FROM fuel_tanks
  WHERE use_type = 'agriculture'
    AND is_active = true
    AND fuel_type = 'diesel'
),
updated_at = now()
WHERE commercial_name = 'Diesel Agrícola'
  AND function = 'fuel';

UPDATE inventory_items
SET current_quantity = (
  SELECT COALESCE(SUM(current_level_gallons), 0)
  FROM fuel_tanks
  WHERE use_type = 'industry'
    AND is_active = true
    AND fuel_type = 'diesel'
),
updated_at = now()
WHERE commercial_name = 'Diesel Industrial'
  AND function = 'fuel';