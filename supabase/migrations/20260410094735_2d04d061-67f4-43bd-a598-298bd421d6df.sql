
-- Safety-net trigger: auto-adjust fuel_tanks.current_level_gallons on every INSERT
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
           updated_at = now()
     WHERE id = NEW.tank_id;

  ELSIF NEW.transaction_type = 'refill' THEN
    UPDATE fuel_tanks
       SET current_level_gallons = LEAST(capacity_gallons, current_level_gallons + NEW.gallons),
           updated_at = now()
     WHERE id = NEW.tank_id;

  ELSIF NEW.transaction_type = 'transfer' THEN
    -- Subtract from source tank
    UPDATE fuel_tanks
       SET current_level_gallons = GREATEST(0, current_level_gallons - NEW.gallons),
           updated_at = now()
     WHERE id = NEW.tank_id;

    -- Add to destination tank
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

CREATE TRIGGER trg_adjust_tank_level
  AFTER INSERT ON public.fuel_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_tank_level_on_fuel_tx();

-- Correct Mobile tank level: deduct the missing 51.6 gal portal dispense
UPDATE public.fuel_tanks
   SET current_level_gallons = 459.2,
       updated_at = now()
 WHERE name ILIKE '%mobile%'
   AND current_level_gallons = 510.8;
