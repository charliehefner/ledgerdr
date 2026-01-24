-- Fuel tanks table
CREATE TABLE public.fuel_tanks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity_gallons NUMERIC NOT NULL,
  fuel_type TEXT NOT NULL DEFAULT 'diesel',
  use_type TEXT NOT NULL CHECK (use_type IN ('agriculture', 'industry')),
  current_level_gallons NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Equipment table (tractors, generators)
CREATE TABLE public.fuel_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('tractor', 'generator')),
  current_hour_meter NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fuel transactions
CREATE TABLE public.fuel_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tank_id UUID NOT NULL REFERENCES public.fuel_tanks(id),
  equipment_id UUID REFERENCES public.fuel_equipment(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('refill', 'dispense')),
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gallons NUMERIC NOT NULL,
  pump_start_reading NUMERIC,
  pump_end_reading NUMERIC,
  hour_meter_reading NUMERIC,
  previous_hour_meter NUMERIC,
  gallons_per_hour NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for fuel_tanks
CREATE POLICY "Admins have full access to fuel tanks"
ON public.fuel_tanks FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view fuel tanks"
ON public.fuel_tanks FOR SELECT
USING (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert fuel tanks"
ON public.fuel_tanks FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can update fuel tanks"
ON public.fuel_tanks FOR UPDATE
USING (has_role(auth.uid(), 'accountant'));

-- RLS policies for fuel_equipment
CREATE POLICY "Admins have full access to fuel equipment"
ON public.fuel_equipment FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view fuel equipment"
ON public.fuel_equipment FOR SELECT
USING (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert fuel equipment"
ON public.fuel_equipment FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can update fuel equipment"
ON public.fuel_equipment FOR UPDATE
USING (has_role(auth.uid(), 'accountant'));

-- RLS policies for fuel_transactions
CREATE POLICY "Admins have full access to fuel transactions"
ON public.fuel_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view fuel transactions"
ON public.fuel_transactions FOR SELECT
USING (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert fuel transactions"
ON public.fuel_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can update fuel transactions"
ON public.fuel_transactions FOR UPDATE
USING (has_role(auth.uid(), 'accountant'));

-- Indexes
CREATE INDEX idx_fuel_transactions_tank ON public.fuel_transactions(tank_id);
CREATE INDEX idx_fuel_transactions_equipment ON public.fuel_transactions(equipment_id);
CREATE INDEX idx_fuel_transactions_date ON public.fuel_transactions(transaction_date);