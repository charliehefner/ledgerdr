-- Add start and end hour meter columns to operations table
ALTER TABLE public.operations 
  ADD COLUMN start_hours NUMERIC,
  ADD COLUMN end_hours NUMERIC;