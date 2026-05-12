-- Vehicles registry
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL DEFAULT current_user_entity_id() REFERENCES public.entities(id),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('motorcycle','pickup','car')),
  name text NOT NULL,
  brand text,
  model text,
  vin text,
  license_plate text,
  maintenance_interval_km integer NOT NULL DEFAULT 5000,
  insurance_expiration date,
  purchase_date date,
  purchase_cost numeric,
  current_km numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_entity ON public.vehicles(entity_id);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.vehicles USING (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id));
CREATE POLICY "Mgmt full access" ON public.vehicles USING (has_role_for_entity(auth.uid(),'management'::app_role,entity_id));
CREATE POLICY "Accountant full access" ON public.vehicles USING (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id));
CREATE POLICY "Supervisor full access" ON public.vehicles USING (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id));
CREATE POLICY "Viewer select" ON public.vehicles FOR SELECT USING (has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id));
CREATE POLICY "Driver select" ON public.vehicles FOR SELECT USING (has_role_for_entity(auth.uid(),'driver'::app_role,entity_id));

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicle maintenance log
CREATE TABLE public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL DEFAULT current_user_entity_id() REFERENCES public.entities(id),
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  km_reading numeric NOT NULL,
  maintenance_type text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_maintenance_vehicle ON public.vehicle_maintenance(vehicle_id);
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.vehicle_maintenance USING (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id));
CREATE POLICY "Mgmt full access" ON public.vehicle_maintenance USING (has_role_for_entity(auth.uid(),'management'::app_role,entity_id));
CREATE POLICY "Accountant full access" ON public.vehicle_maintenance USING (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id));
CREATE POLICY "Supervisor full access" ON public.vehicle_maintenance USING (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id));
CREATE POLICY "Viewer select" ON public.vehicle_maintenance FOR SELECT USING (has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id));
CREATE POLICY "Driver select" ON public.vehicle_maintenance FOR SELECT USING (has_role_for_entity(auth.uid(),'driver'::app_role,entity_id));

-- Link refueling transactions to vehicle + km
ALTER TABLE public.transactions
  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id),
  ADD COLUMN vehicle_km numeric;

-- Alert configs (idempotent insert)
INSERT INTO public.alert_configurations (alert_type, is_active, threshold_value)
VALUES ('vehicle_maintenance_km', true, 90),
       ('vehicle_insurance_expiry', true, 30)
ON CONFLICT (alert_type) DO NOTHING;