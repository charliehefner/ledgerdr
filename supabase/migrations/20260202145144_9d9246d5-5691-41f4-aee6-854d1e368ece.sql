-- Add policies for supervisors to have full access to day_labor_entries
CREATE POLICY "Supervisor full access to day labor entries"
ON public.day_labor_entries
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));