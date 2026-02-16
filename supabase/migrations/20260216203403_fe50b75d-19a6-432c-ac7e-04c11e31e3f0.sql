
-- Add gpsgate_user_id to fuel_equipment for tractor-to-GPS device linking
ALTER TABLE public.fuel_equipment ADD COLUMN gpsgate_user_id integer;

-- Add working_width_m to implements for area calculation
ALTER TABLE public.implements ADD COLUMN working_width_m numeric;
