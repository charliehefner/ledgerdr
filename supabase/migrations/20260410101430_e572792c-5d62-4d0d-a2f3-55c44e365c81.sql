
-- Update trigger to also set last_pump_end_reading on dispense
CREATE OR REPLACE FUNCTION public.adjust_tank_level_on_fuel_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.transaction_type = 'dispense' THEN
    UPDATE fuel_tanks
       SET current_level_gallons = GREATEST(0, current_level_gallons - NEW.gallons),
           last_pump_end_reading = COALESCE(NEW.pump_end_reading, last_pump_end_reading),
           updated_at = now()
     WHERE id = NEW.tank_id;

  ELSIF NEW.transaction_type = 'refill' THEN
    UPDATE fuel_tanks
       SET current_level_gallons = LEAST(capacity_gallons, current_level_gallons + NEW.gallons),
           updated_at = now()
     WHERE id = NEW.tank_id;

  ELSIF NEW.transaction_type = 'transfer' THEN
    UPDATE fuel_tanks
       SET current_level_gallons = GREATEST(0, current_level_gallons - NEW.gallons),
           updated_at = now()
     WHERE id = NEW.tank_id;

    IF NEW.destination_tank_id IS NOT NULL THEN
      UPDATE fuel_tanks
         SET current_level_gallons = LEAST(capacity_gallons, current_level_gallons + NEW.gallons),
             updated_at = now()
       WHERE id = NEW.destination_tank_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix current Mobile tank pump reading to match last dispense
UPDATE fuel_tanks SET last_pump_end_reading = 100.4, updated_at = now() WHERE name ILIKE '%mobile%';
