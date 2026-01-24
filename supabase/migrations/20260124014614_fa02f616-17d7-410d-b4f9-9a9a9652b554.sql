-- Drop the existing position check constraint
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_position_check;

-- Add updated constraint with all 7 positions
ALTER TABLE public.employees ADD CONSTRAINT employees_position_check 
CHECK (position IN ('Obrero', 'Supervisor', 'Tractorista', 'Gerencia', 'Administrativa', 'Volteador', 'Sereno'));