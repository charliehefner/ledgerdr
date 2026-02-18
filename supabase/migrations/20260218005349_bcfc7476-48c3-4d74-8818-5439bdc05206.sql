
-- payment_method_accounts: maps transaction pay_method → chart_of_accounts
CREATE TABLE public.payment_method_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_method text UNIQUE NOT NULL,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_method_accounts ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "Authenticated users can read payment_method_accounts"
  ON public.payment_method_accounts FOR SELECT TO authenticated
  USING (true);

-- Write access for admin, management, accountant
CREATE POLICY "Admin/management/accountant can insert payment_method_accounts"
  ON public.payment_method_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/management/accountant can update payment_method_accounts"
  ON public.payment_method_accounts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/management/accountant can delete payment_method_accounts"
  ON public.payment_method_accounts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Timestamp trigger
CREATE TRIGGER update_payment_method_accounts_updated_at
  BEFORE UPDATE ON public.payment_method_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial mappings
INSERT INTO public.payment_method_accounts (pay_method, account_id)
SELECT pm.pay_method, coa.id
FROM (VALUES
  ('cash',         '1910'),
  ('transfer_bhd', '1930'),
  ('Transfer BHD', '1930'),
  ('transfer_bdi', '1940'),
  ('cc_management','1930')
) AS pm(pay_method, account_code)
JOIN public.chart_of_accounts coa ON coa.account_code = pm.account_code AND coa.deleted_at IS NULL;
