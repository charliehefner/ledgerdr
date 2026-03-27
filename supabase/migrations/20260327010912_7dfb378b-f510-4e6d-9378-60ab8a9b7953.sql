-- Transportation units master table
CREATE TABLE public.transportation_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('truck', 'trailer', 'wagon')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transportation_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read transportation_units"
  ON public.transportation_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transportation_units"
  ON public.transportation_units FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update transportation_units"
  ON public.transportation_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transportation_units"
  ON public.transportation_units FOR DELETE TO authenticated USING (true);

-- Seed initial data
INSERT INTO public.transportation_units (name, unit_type) VALUES
  ('Bigab01', 'wagon'),
  ('Bigab02', 'wagon');

-- Add identifier column to carretas and trucks
ALTER TABLE public.industrial_carretas ADD COLUMN identifier text;
ALTER TABLE public.industrial_trucks ADD COLUMN identifier text;