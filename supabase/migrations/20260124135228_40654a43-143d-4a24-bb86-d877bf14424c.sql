-- Create enum for inventory item functions
CREATE TYPE inventory_function AS ENUM (
  'fertilizer',
  'fuel',
  'pre_emergent_herbicide',
  'post_emergent_herbicide',
  'pesticide',
  'fungicide',
  'insecticide',
  'seed',
  'other'
);

-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commercial_name TEXT NOT NULL,
  molecule_name TEXT,
  function inventory_function NOT NULL DEFAULT 'other',
  use_unit TEXT NOT NULL DEFAULT 'kg',
  sack_weight_kg NUMERIC,
  supplier TEXT,
  purchase_unit_quantity NUMERIC NOT NULL DEFAULT 1,
  purchase_unit_type TEXT NOT NULL DEFAULT 'unit',
  price_per_purchase_unit NUMERIC NOT NULL DEFAULT 0,
  co2_equivalent NUMERIC,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory_purchases table
CREATE TABLE public.inventory_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  document_number TEXT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_items
CREATE POLICY "Admins have full access to inventory items"
ON public.inventory_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view inventory items"
ON public.inventory_items FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert inventory items"
ON public.inventory_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update inventory items"
ON public.inventory_items FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for inventory_purchases
CREATE POLICY "Admins have full access to inventory purchases"
ON public.inventory_purchases FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view inventory purchases"
ON public.inventory_purchases FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert inventory purchases"
ON public.inventory_purchases FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update inventory purchases"
ON public.inventory_purchases FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Trigger for updated_at on inventory_items
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();