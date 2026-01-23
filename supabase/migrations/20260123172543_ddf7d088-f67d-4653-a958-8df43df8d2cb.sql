-- Add position/category column to employees table
ALTER TABLE public.employees 
ADD COLUMN position text NOT NULL DEFAULT 'Obrero';

-- Add a check constraint for valid positions
ALTER TABLE public.employees 
ADD CONSTRAINT employees_position_check 
CHECK (position IN ('Obrero', 'Supervisor', 'Tractorista', 'Gerencia', 'Administrativa'));