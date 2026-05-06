DROP POLICY IF EXISTS "Admin/mgmt/acct can insert service entries" ON public.service_entries;
DROP POLICY IF EXISTS "Admin/mgmt/acct can update service entries" ON public.service_entries;

CREATE POLICY "Authorized roles can insert service entries"
ON public.service_entries
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'office'::app_role)
);

CREATE POLICY "Authorized roles can update service entries"
ON public.service_entries
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR has_role(auth.uid(), 'accountant'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'office'::app_role)
);