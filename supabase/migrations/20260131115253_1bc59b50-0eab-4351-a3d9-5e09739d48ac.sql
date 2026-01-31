-- Add new values to inventory_function enum
ALTER TYPE public.inventory_function ADD VALUE IF NOT EXISTS 'condicionador';
ALTER TYPE public.inventory_function ADD VALUE IF NOT EXISTS 'adherente';