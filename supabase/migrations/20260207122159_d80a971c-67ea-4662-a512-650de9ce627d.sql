-- Phase 1b: Driver Fueling Portal Schema Changes (columns, tables, triggers, policies)

-- 1.2 Add last_pump_end_reading to fuel_tanks for validation
ALTER TABLE public.fuel_tanks 
ADD COLUMN IF NOT EXISTS last_pump_end_reading NUMERIC DEFAULT 0;

-- 1.3 Add tracking columns to fuel_transactions
ALTER TABLE public.fuel_transactions 
ADD COLUMN IF NOT EXISTS submitted_by UUID,
ADD COLUMN IF NOT EXISTS submission_source TEXT DEFAULT 'manual';

-- 1.4 Create pending submissions table for offline sync and photo cleanup
CREATE TABLE IF NOT EXISTS public.pending_fuel_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuel_transaction_id UUID REFERENCES fuel_transactions(id) ON DELETE CASCADE,
    photos JSONB,
    submitted_by UUID,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on pending_fuel_submissions
ALTER TABLE public.pending_fuel_submissions ENABLE ROW LEVEL SECURITY;

-- 1.5 Create trigger function to update last_pump_end_reading
CREATE OR REPLACE FUNCTION public.update_tank_last_pump_reading()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'dispense' AND NEW.pump_end_reading IS NOT NULL THEN
    UPDATE fuel_tanks 
    SET last_pump_end_reading = NEW.pump_end_reading,
        updated_at = now()
    WHERE id = NEW.tank_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger (drop if exists first to avoid conflicts)
DROP TRIGGER IF EXISTS trg_update_tank_pump_reading ON fuel_transactions;
CREATE TRIGGER trg_update_tank_pump_reading
AFTER INSERT ON fuel_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_tank_last_pump_reading();

-- 1.6 Backfill last_pump_end_reading from existing data
UPDATE fuel_tanks t
SET last_pump_end_reading = COALESCE((
  SELECT pump_end_reading 
  FROM fuel_transactions ft
  WHERE ft.tank_id = t.id 
    AND ft.transaction_type = 'dispense'
    AND ft.pump_end_reading IS NOT NULL
  ORDER BY transaction_date DESC, created_at DESC
  LIMIT 1
), 0);

-- RLS Policies for drivers on fuel_equipment (tractors only)
CREATE POLICY "Drivers can read tractors"
ON public.fuel_equipment
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver') 
  AND equipment_type = 'tractor'
  AND is_active = true
);

-- RLS Policy for drivers on fuel_tanks (agriculture only)
CREATE POLICY "Drivers can read agriculture tanks"
ON public.fuel_tanks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver') 
  AND use_type = 'agriculture'
  AND is_active = true
);

-- Drivers can insert fuel transactions (dispense only)
CREATE POLICY "Drivers can insert dispense transactions"
ON public.fuel_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'driver') 
  AND transaction_type = 'dispense'
  AND submitted_by = auth.uid()
);

-- Drivers can insert pending submissions
CREATE POLICY "Drivers can insert pending submissions"
ON public.pending_fuel_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'driver') 
  AND submitted_by = auth.uid()
);

-- Drivers can read their own pending submissions
CREATE POLICY "Drivers can read own pending submissions"
ON public.pending_fuel_submissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver') 
  AND submitted_by = auth.uid()
);

-- Admins/Management can manage pending submissions
CREATE POLICY "Admins can manage pending submissions"
ON public.pending_fuel_submissions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'management')
);