
CREATE OR REPLACE FUNCTION public.save_operation_inputs(
  p_operation_id UUID,
  p_inputs JSONB DEFAULT '[]'::jsonb,
  p_restore_original BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_input RECORD;
BEGIN
  -- 1. If restoring, add back old quantities
  IF p_restore_original THEN
    FOR v_rec IN
      SELECT inventory_item_id, quantity_used
      FROM operation_inputs
      WHERE operation_id = p_operation_id
    LOOP
      UPDATE inventory_items
      SET current_quantity = ROUND((current_quantity + v_rec.quantity_used)::numeric, 4)
      WHERE id = v_rec.inventory_item_id;
    END LOOP;
  END IF;

  -- 2. Delete existing inputs
  DELETE FROM operation_inputs WHERE operation_id = p_operation_id;

  -- 3. Insert new inputs and deduct from stock
  FOR v_input IN
    SELECT * FROM jsonb_to_recordset(p_inputs)
      AS x(inventory_item_id UUID, quantity_used NUMERIC)
  LOOP
    INSERT INTO operation_inputs (operation_id, inventory_item_id, quantity_used, entity_id)
    SELECT p_operation_id, v_input.inventory_item_id, v_input.quantity_used, o.entity_id
    FROM operations o WHERE o.id = p_operation_id;

    UPDATE inventory_items
    SET current_quantity = ROUND((current_quantity - v_input.quantity_used)::numeric, 4)
    WHERE id = v_input.inventory_item_id;
  END LOOP;
END;
$$;
