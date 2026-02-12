
-- Create service_providers table
CREATE TABLE public.service_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  bank TEXT,
  bank_account_type TEXT CHECK (bank_account_type IN ('savings', 'current')),
  currency TEXT DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  bank_account_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_entries table
CREATE TABLE public.service_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  master_acct_code TEXT,
  description TEXT,
  amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  comments TEXT,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_service_entries_provider ON public.service_entries(provider_id);
CREATE INDEX idx_service_entries_closed ON public.service_entries(is_closed);

-- Enable RLS
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_entries ENABLE ROW LEVEL SECURITY;

-- RLS for service_providers
CREATE POLICY "Authenticated users can view service providers"
  ON public.service_providers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/mgmt/acct/supervisor can insert service providers"
  ON public.service_providers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admin/mgmt/acct/supervisor can update service providers"
  ON public.service_providers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- RLS for service_entries
CREATE POLICY "Authenticated users can view service entries"
  ON public.service_entries FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/mgmt/acct can insert service entries"
  ON public.service_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/mgmt/acct can update service entries"
  ON public.service_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/mgmt can delete service entries"
  ON public.service_entries FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management')
  );

-- Timestamp trigger
CREATE TRIGGER update_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_entries_updated_at
  BEFORE UPDATE ON public.service_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
