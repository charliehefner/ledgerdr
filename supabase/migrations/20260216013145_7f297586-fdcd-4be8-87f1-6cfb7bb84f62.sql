
CREATE TABLE public.vendor_account_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL UNIQUE,
  master_acct_code text NOT NULL,
  project_code text,
  cbs_code text,
  description_template text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_account_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_rules_read" ON public.vendor_account_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendor_rules_write" ON public.vendor_account_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "vendor_rules_update" ON public.vendor_account_rules
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "vendor_rules_delete" ON public.vendor_account_rules
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE TRIGGER update_vendor_account_rules_updated_at
  BEFORE UPDATE ON public.vendor_account_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
