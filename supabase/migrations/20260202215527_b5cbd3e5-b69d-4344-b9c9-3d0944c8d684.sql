-- Create service_contracts table
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_cedula_rnc TEXT,
  bank TEXT,
  bank_account TEXT,
  operation_type TEXT NOT NULL,
  operation_type_other TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('m3', 'hours', 'hectares')),
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  farm_id UUID REFERENCES public.farms(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service_contract_entries table for daily operations
CREATE TABLE public.service_contract_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  comments TEXT,
  units_charged NUMERIC NOT NULL DEFAULT 0,
  calculated_cost NUMERIC NOT NULL DEFAULT 0,
  cost_override NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service_contract_line_items table for additional costs (transportation, etc.)
CREATE TABLE public.service_contract_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.service_contract_entries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view contracts" ON public.service_contracts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contracts" ON public.service_contracts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contracts" ON public.service_contracts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete contracts" ON public.service_contracts
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view entries" ON public.service_contract_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert entries" ON public.service_contract_entries
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update entries" ON public.service_contract_entries
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete entries" ON public.service_contract_entries
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view line items" ON public.service_contract_line_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert line items" ON public.service_contract_line_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update line items" ON public.service_contract_line_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete line items" ON public.service_contract_line_items
  FOR DELETE TO authenticated USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_service_contracts_updated_at
  BEFORE UPDATE ON public.service_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_contract_entries_updated_at
  BEFORE UPDATE ON public.service_contract_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();