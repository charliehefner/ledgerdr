-- Add policy for supervisors to have full access to jornaleros
CREATE POLICY "Supervisor full access to jornaleros"
ON public.jornaleros
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));