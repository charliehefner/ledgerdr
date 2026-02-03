-- Add comments column to service_contracts for internal notes
ALTER TABLE public.service_contracts 
ADD COLUMN comments TEXT;