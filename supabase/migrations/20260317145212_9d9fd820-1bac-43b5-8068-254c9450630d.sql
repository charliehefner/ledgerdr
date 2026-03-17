-- Fix tractor hour meters that were corrupted by fuel transaction updates.
-- Reset current_hour_meter to the canonical MAX(end_hours) from operations log.
UPDATE fuel_equipment fe
SET current_hour_meter = COALESCE(
  (SELECT MAX(end_hours) FROM operations WHERE tractor_id = fe.id AND end_hours IS NOT NULL),
  fe.current_hour_meter
),
updated_at = now()
WHERE fe.equipment_type = 'tractor'
AND fe.current_hour_meter != COALESCE(
  (SELECT MAX(end_hours) FROM operations WHERE tractor_id = fe.id AND end_hours IS NOT NULL),
  fe.current_hour_meter
);