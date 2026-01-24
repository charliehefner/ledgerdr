-- Add fields to fuel_equipment table (tractors)
ALTER TABLE public.fuel_equipment
ADD COLUMN serial_number text,
ADD COLUMN brand text,
ADD COLUMN model text,
ADD COLUMN hp numeric,
ADD COLUMN purchase_date date,
ADD COLUMN purchase_price numeric;

-- Add fields to implements table
ALTER TABLE public.implements
ADD COLUMN serial_number text,
ADD COLUMN brand text,
ADD COLUMN model text,
ADD COLUMN purchase_date date,
ADD COLUMN purchase_price numeric;