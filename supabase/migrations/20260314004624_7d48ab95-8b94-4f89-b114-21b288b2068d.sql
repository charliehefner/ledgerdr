
-- Add date_of_termination column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_termination date NULL;

-- Drop and recreate the employees_safe view to include date_of_termination
DROP VIEW IF EXISTS public.employees_safe;

CREATE VIEW public.employees_safe 
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  position,
  date_of_hire,
  date_of_termination,
  salary,
  is_active,
  shirt_size,
  pant_size,
  boot_size,
  date_of_birth,
  created_at,
  updated_at,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN cedula
    ELSE '***-*******-' || RIGHT(cedula, 1)
  END as cedula,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN bank
    ELSE bank
  END as bank,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN bank_account_number
    ELSE '****' || RIGHT(COALESCE(bank_account_number, ''), 4)
  END as bank_account_number
FROM public.employees;
