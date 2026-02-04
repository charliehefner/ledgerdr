-- Update CAS number constraint to allow standard format with hyphens (e.g., 81406-37-3)
ALTER TABLE public.inventory_items DROP CONSTRAINT cas_number_format;

ALTER TABLE public.inventory_items ADD CONSTRAINT cas_number_format 
CHECK (cas_number IS NULL OR cas_number ~ '^\d{1,7}-\d{2}-\d{1}$');