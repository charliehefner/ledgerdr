-- Add supplier and packaging fields to inventory_purchases
ALTER TABLE public.inventory_purchases 
ADD COLUMN supplier text,
ADD COLUMN packaging_quantity numeric NOT NULL DEFAULT 1,
ADD COLUMN packaging_unit text NOT NULL DEFAULT 'unit';