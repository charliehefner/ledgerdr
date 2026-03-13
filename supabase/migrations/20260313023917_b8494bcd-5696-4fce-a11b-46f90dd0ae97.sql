
CREATE TABLE public.tractor_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tractor_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tractor_operators"
ON public.tractor_operators FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert tractor_operators"
ON public.tractor_operators FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update tractor_operators"
ON public.tractor_operators FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tractor_operators"
ON public.tractor_operators FOR DELETE TO authenticated
USING (true);

CREATE TRIGGER update_tractor_operators_updated_at
  BEFORE UPDATE ON public.tractor_operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tractor_operators (name) VALUES
  ('Maikol'),
  ('Dioni'),
  ('Oscar'),
  ('Henrique'),
  ('Chicho');
