-- Add CAS number and normal dose fields to inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN cas_number TEXT,
ADD COLUMN normal_dose_per_ha NUMERIC(4,2);

-- Add constraint for CAS number format (up to 10 digits)
ALTER TABLE public.inventory_items 
ADD CONSTRAINT cas_number_format CHECK (cas_number IS NULL OR cas_number ~ '^\d{1,10}$');

-- Add constraint for normal dose range (0.01 to 9.99)
ALTER TABLE public.inventory_items 
ADD CONSTRAINT normal_dose_range CHECK (normal_dose_per_ha IS NULL OR (normal_dose_per_ha >= 0.01 AND normal_dose_per_ha <= 9.99));