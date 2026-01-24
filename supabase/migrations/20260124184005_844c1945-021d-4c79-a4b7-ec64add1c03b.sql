-- Create farms table
CREATE TABLE public.farms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fields table
CREATE TABLE public.fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hectares NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(farm_id, name)
);

-- Create implements table (separate from tractors in fuel_equipment)
CREATE TABLE public.implements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  implement_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create operation_types table
CREATE TABLE public.operation_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_mechanical BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create operations table
CREATE TABLE public.operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  field_id UUID NOT NULL REFERENCES public.fields(id),
  operation_type_id UUID NOT NULL REFERENCES public.operation_types(id),
  tractor_id UUID REFERENCES public.fuel_equipment(id),
  implement_id UUID REFERENCES public.implements(id),
  workers_count INTEGER,
  hectares_done NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create operation_inputs junction table for inventory usage
CREATE TABLE public.operation_inputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity_used NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_inputs ENABLE ROW LEVEL SECURITY;

-- Farms policies
CREATE POLICY "Admins have full access to farms" ON public.farms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view farms" ON public.farms FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- Fields policies
CREATE POLICY "Admins have full access to fields" ON public.fields FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view fields" ON public.fields FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- Implements policies
CREATE POLICY "Admins have full access to implements" ON public.implements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view implements" ON public.implements FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert implements" ON public.implements FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update implements" ON public.implements FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));

-- Operation types policies
CREATE POLICY "Admins have full access to operation_types" ON public.operation_types FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view operation_types" ON public.operation_types FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- Operations policies
CREATE POLICY "Admins have full access to operations" ON public.operations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view operations" ON public.operations FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert operations" ON public.operations FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update operations" ON public.operations FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));

-- Operation inputs policies
CREATE POLICY "Admins have full access to operation_inputs" ON public.operation_inputs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view operation_inputs" ON public.operation_inputs FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert operation_inputs" ON public.operation_inputs FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update operation_inputs" ON public.operation_inputs FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can delete operation_inputs" ON public.operation_inputs FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON public.farms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fields_updated_at BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_implements_updated_at BEFORE UPDATE ON public.implements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_operations_updated_at BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();