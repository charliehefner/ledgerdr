CREATE OR REPLACE VIEW public.employees_safe
WITH (security_invoker = on) AS
SELECT
  id, name, "position", date_of_hire, date_of_termination, salary,
  is_active, shirt_size, pant_size, boot_size, date_of_birth,
  entity_id, sex, created_at, updated_at,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
      OR has_role(auth.uid(), 'office'::app_role)
    THEN cedula
    ELSE '***-*******-'::text || "right"(cedula, 1)
  END AS cedula,
  bank,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'management'::app_role)
    THEN bank_account_number
    ELSE '****'::text || "right"(COALESCE(bank_account_number, ''::text), 4)
  END AS bank_account_number
FROM public.employees;