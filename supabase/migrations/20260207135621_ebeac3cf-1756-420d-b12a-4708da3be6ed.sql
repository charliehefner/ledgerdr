-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow authenticated read access to tractor_maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Allow authenticated insert access to tractor_maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Allow authenticated update access to tractor_maintenance" ON public.tractor_maintenance;
DROP POLICY IF EXISTS "Allow authenticated delete access to tractor_maintenance" ON public.tractor_maintenance;

-- Create role-based policies
CREATE POLICY "Admins have full access to tractor maintenance"
ON public.tractor_maintenance FOR ALL
USING (public.has_role(auth.uid(), 'admin')) 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management has full access to tractor maintenance"
ON public.tractor_maintenance FOR ALL
USING (public.has_role(auth.uid(), 'management'))
WITH CHECK (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Supervisors have full access to tractor maintenance"
ON public.tractor_maintenance FOR ALL
USING (public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Accountants can view tractor maintenance"
ON public.tractor_maintenance FOR SELECT
USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Viewers can view tractor maintenance"
ON public.tractor_maintenance FOR SELECT
USING (public.has_role(auth.uid(), 'viewer'));