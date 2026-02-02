-- Allow hectares_done to be nullable for two-stage operation recording
-- Morning entry: basic data (date, field, operation type, tractor, start hours)
-- End of day: complete with end hours, hectares done, inputs
ALTER TABLE public.operations 
ALTER COLUMN hectares_done DROP NOT NULL;

-- Add default of 0 for hectares_done
ALTER TABLE public.operations 
ALTER COLUMN hectares_done SET DEFAULT 0;