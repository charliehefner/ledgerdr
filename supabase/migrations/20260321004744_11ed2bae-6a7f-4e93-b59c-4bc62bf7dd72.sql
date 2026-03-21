CREATE OR REPLACE FUNCTION public.sync_fuel_tanks_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_use_type TEXT;
  v_total_level NUMERIC;
  v_item_id UUID;
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
    SELECT id INTO v_item_id FROM inventory_items
    WHERE commercial_name = 'Diesel Agrícola' AND function = 'fuel' LIMIT 1;
  ELSIF v_use_type = 'industry' THEN
    SELECT id INTO v_item_id FROM inventory_items
    WHERE commercial_name = 'Diesel Industrial' AND function = 'fuel' LIMIT 1;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_item_id IS NULL THEN
    RAISE WARNING 'Fuel inventory item not found for use_type: %', v_use_type;
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE inventory_items
  SET current_quantity = v_total_level,
      updated_at = now()
  WHERE id = v_item_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;