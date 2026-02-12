
-- Create alert_configurations table
CREATE TABLE public.alert_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  threshold_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_configurations ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users
CREATE POLICY "Authenticated users can read alert configurations"
ON public.alert_configurations
FOR SELECT
TO authenticated
USING (true);

-- Write for admin/management only
CREATE POLICY "Admin and management can manage alert configurations"
ON public.alert_configurations
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
);

-- Trigger for updated_at
CREATE TRIGGER update_alert_configurations_updated_at
BEFORE UPDATE ON public.alert_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default configurations
INSERT INTO public.alert_configurations (alert_type, is_active, threshold_value) VALUES
  ('vacation_upcoming', true, 30),
  ('fuel_tank_low', true, 10),
  ('maintenance_due', true, 20),
  ('inventory_low', true, NULL),
  ('followup_inputs_missing', true, NULL),
  ('overdue_followups', true, NULL);

-- Add minimum_stock column to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC;
