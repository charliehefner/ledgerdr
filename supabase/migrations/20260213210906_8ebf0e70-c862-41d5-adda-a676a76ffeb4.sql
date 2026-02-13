
-- Drop old check constraint
ALTER TABLE public.employees DROP CONSTRAINT employees_position_check;

-- Update existing data
UPDATE public.employees SET position = 'Servicios Generales' WHERE position = 'Obrero';

-- Add new check constraint with correct position name
ALTER TABLE public.employees ADD CONSTRAINT employees_position_check 
  CHECK (position = ANY (ARRAY['Servicios Generales', 'Supervisor', 'Tractorista', 'Gerencia', 'Administrativa', 'Volteador', 'Sereno']));
