-- Create jornaleros table for day laborer registry
CREATE TABLE public.jornaleros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jornaleros ENABLE ROW LEVEL SECURITY;

-- Admin and management have full access
CREATE POLICY "Admin and management full access to jornaleros"
ON public.jornaleros
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

-- Accountant can only read (to select laborers for entries)
CREATE POLICY "Accountant can view jornaleros"
ON public.jornaleros
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accountant'));

-- Trigger for updated_at
CREATE TRIGGER update_jornaleros_updated_at
BEFORE UPDATE ON public.jornaleros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();