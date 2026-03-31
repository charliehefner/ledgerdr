CREATE OR REPLACE FUNCTION public.sync_fuel_tanks_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_use_type TEXT;
  v_total_level NUMERIC;
  v_item_id UUID;
  v_system_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_use_type := OLD.use_type;
  ELSE
    v_use_type := NEW.use_type;
  END IF;

  SELECT COALESCE(SUM(current_level_gallons), 0)
  INTO v_total_level
  FROM fuel_tanks
  WHERE use_type = v_use_type
    AND is_active = true
    AND fuel_type = 'diesel';

  IF v_use_type = 'agriculture' THEN
    v_system_key := 'diesel_agricola';
  ELSIF v_use_type = 'industry' THEN
    v_system_key := 'diesel_industrial';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_item_id FROM inventory_items
  WHERE system_key = v_system_key LIMIT 1;

  IF v_item_id IS NULL THEN
    RAISE WARNING 'Fuel inventory item not found for system_key: %', v_system_key;
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE inventory_items
  SET current_quantity = v_total_level,
      updated_at = now()
  WHERE id = v_item_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;