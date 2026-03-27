-- Reset Landini 90S hour meter to 0 (new hour meter installed)
UPDATE fuel_equipment 
SET current_hour_meter = 0, updated_at = now()
WHERE id = 'c2de1bf0-5a56-44ea-b9b2-d20b07c43025';

-- Record maintenance done today
INSERT INTO tractor_maintenance (tractor_id, hour_meter_reading, maintenance_date, maintenance_type, notes)
VALUES ('c2de1bf0-5a56-44ea-b9b2-d20b07c43025', 0, CURRENT_DATE, 'service', 'Nuevo horómetro instalado, reinicio a 0');