
CREATE OR REPLACE FUNCTION public.save_operation_inputs(
  p_operation_id UUID,
  p_inputs JSONB DEFAULT '[]'::jsonb,
  p_restore_original BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_input JSONB;
BEGIN
  -- Step 1: If restoring, add back original quantities to inventory
  IF p_restore_original THEN
    FOR v_rec IN
      SELECT inventory_item_id, quantity_used
      FROM operation_inputs
      WHERE operation_id = p_operation_id
    LOOP
      UPDATE inventory_items
      SET current_quantity = current_quantity + v_rec.quantity_used
      WHERE id = v_rec.inventory_item_id;
    END LOOP;
  END IF;

  -- Step 2: Delete existing operation_inputs for this operation
  DELETE FROM operation_inputs WHERE operation_id = p_operation_id;

  -- Step 3: Insert new inputs and deduct from inventory
  FOR v_input IN SELECT * FROM jsonb_array_elements(p_inputs)
  LOOP
    INSERT INTO operation_inputs (operation_id, inventory_item_id, quantity_used)
    VALUES (
      p_operation_id,
      (v_input->>'inventory_item_id')::UUID,
      (v_input->>'quantity_used')::NUMERIC
    );

    UPDATE inventory_items
    SET current_quantity = current_quantity - (v_input->>'quantity_used')::NUMERIC
    WHERE id = (v_input->>'inventory_item_id')::UUID;
  END LOOP;
END;
$$;
