-- Create table for tractor maintenance records
CREATE TABLE public.tractor_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tractor_id UUID NOT NULL REFERENCES public.fuel_equipment(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hour_meter_reading NUMERIC NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'routine',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tractor_maintenance ENABLE ROW LEVEL SECURITY;

-- Create policies for access (following existing patterns)
CREATE POLICY "Allow authenticated read access to tractor_maintenance"
ON public.tractor_maintenance
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert access to tractor_maintenance"
ON public.tractor_maintenance
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to tractor_maintenance"
ON public.tractor_maintenance
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete access to tractor_maintenance"
ON public.tractor_maintenance
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster lookups by tractor
CREATE INDEX idx_tractor_maintenance_tractor_id ON public.tractor_maintenance(tractor_id);
CREATE INDEX idx_tractor_maintenance_date ON public.tractor_maintenance(maintenance_date DESC);

-- Add maintenance_interval_hours column to fuel_equipment for custom intervals
ALTER TABLE public.fuel_equipment 
ADD COLUMN maintenance_interval_hours INTEGER NOT NULL DEFAULT 500;

-- Create function to get hours until next maintenance
CREATE OR REPLACE FUNCTION public.get_hours_until_maintenance(
  p_tractor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_hours NUMERIC;
  v_last_maintenance_hours NUMERIC;
  v_interval INTEGER;
  v_hours_since_maintenance NUMERIC;
  v_hours_until NUMERIC;
BEGIN
  -- Get current hour meter and maintenance interval
  SELECT current_hour_meter, maintenance_interval_hours
  INTO v_current_hours, v_interval
  FROM fuel_equipment
  WHERE id = p_tractor_id;
  
  -- Get the most recent maintenance hour meter reading
  SELECT hour_meter_reading
  INTO v_last_maintenance_hours
  FROM tractor_maintenance
  WHERE tractor_id = p_tractor_id
  ORDER BY hour_meter_reading DESC
  LIMIT 1;
  
  -- If no maintenance recorded, calculate from 0
  IF v_last_maintenance_hours IS NULL THEN
    v_last_maintenance_hours := 0;
  END IF;
  
  -- Calculate hours until next maintenance
  v_hours_since_maintenance := v_current_hours - v_last_maintenance_hours;
  v_hours_until := v_interval - v_hours_since_maintenance;
  
  RETURN v_hours_until::INTEGER;
END;
$$;