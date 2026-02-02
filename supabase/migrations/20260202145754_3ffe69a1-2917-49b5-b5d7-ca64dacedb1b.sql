-- Add SELECT policy for supervisors on employees table (for cronograma worker list)
-- Note: Supervisors can only view basic employee info (id, name, position), not sensitive data like salary
CREATE POLICY "Supervisor can view employees for schedule"
ON public.employees
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Add SELECT policy for supervisors on employee_vacations (for cronograma vacation display)
CREATE POLICY "Supervisor can view vacations for schedule"
ON public.employee_vacations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));