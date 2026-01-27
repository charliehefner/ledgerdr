-- Add workers_count column (required, with default for existing data)
ALTER TABLE public.day_labor_entries 
ADD COLUMN workers_count integer NOT NULL DEFAULT 1;

-- Add field_name column (optional)
ALTER TABLE public.day_labor_entries 
ADD COLUMN field_name text;