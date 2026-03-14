
-- contacts table
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rnc varchar(20) UNIQUE,
  contact_type text NOT NULL DEFAULT 'supplier',
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- contact_bank_accounts table
CREATE TABLE public.contact_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text DEFAULT 'checking',
  currency varchar(3) NOT NULL DEFAULT 'DOP',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger for contacts
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Management/Accountant can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/Management/Accountant can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/Management can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management')
  );

-- RLS on contact_bank_accounts
ALTER TABLE public.contact_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contact bank accounts"
  ON public.contact_bank_accounts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/Management/Accountant can insert contact bank accounts"
  ON public.contact_bank_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/Management/Accountant can update contact bank accounts"
  ON public.contact_bank_accounts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/Management/Accountant can delete contact bank accounts"
  ON public.contact_bank_accounts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Index for fast lookups
CREATE INDEX idx_contacts_rnc ON public.contacts(rnc) WHERE rnc IS NOT NULL;
CREATE INDEX idx_contacts_name ON public.contacts(name);
CREATE INDEX idx_contact_bank_accounts_contact_id ON public.contact_bank_accounts(contact_id);
