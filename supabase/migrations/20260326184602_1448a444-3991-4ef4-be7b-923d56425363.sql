
-- 1. Plant Hours
CREATE TABLE public.industrial_plant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date,
  start_hour_meter numeric,
  finish_hour_meter numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.industrial_plant_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and supervisor full access on plant_hours"
  ON public.industrial_plant_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER update_industrial_plant_hours_updated_at
  BEFORE UPDATE ON public.industrial_plant_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Carretas
CREATE TABLE public.industrial_carretas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datetime_out timestamptz,
  datetime_in timestamptz,
  tare numeric,
  payload numeric,
  weigh_ticket_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.industrial_carretas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and supervisor full access on carretas"
  ON public.industrial_carretas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER update_industrial_carretas_updated_at
  BEFORE UPDATE ON public.industrial_carretas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Trucks
CREATE TABLE public.industrial_trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datetime_in timestamptz,
  datetime_out timestamptz,
  tare numeric,
  payload numeric,
  weigh_ticket_number text,
  destination_payload text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.industrial_trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and supervisor full access on trucks"
  ON public.industrial_trucks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER update_industrial_trucks_updated_at
  BEFORE UPDATE ON public.industrial_trucks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
