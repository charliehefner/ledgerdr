-- Create table for cronograma (weekly schedule) entries
CREATE TABLE public.cronograma_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_ending_date DATE NOT NULL, -- Saturday of the week
  worker_type TEXT NOT NULL CHECK (worker_type IN ('employee', 'jornalero')),
  worker_id UUID, -- References employees.id or jornaleros.id depending on type
  worker_name TEXT NOT NULL, -- Denormalized for display
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Monday, 6=Saturday
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'afternoon')),
  task TEXT,
  is_vacation BOOLEAN DEFAULT false,
  is_holiday BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking closed weeks
CREATE TABLE public.cronograma_weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_ending_date DATE NOT NULL UNIQUE,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cronograma_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_weeks ENABLE ROW LEVEL SECURITY;

-- Create index for efficient queries
CREATE INDEX idx_cronograma_entries_week ON public.cronograma_entries(week_ending_date);
CREATE INDEX idx_cronograma_entries_worker ON public.cronograma_entries(worker_type, worker_id);

-- RLS Policies for cronograma_entries
CREATE POLICY "Users with appropriate roles can view cronograma entries"
ON public.cronograma_entries
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role) OR
  public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Admins, management, and supervisors can insert cronograma entries"
ON public.cronograma_entries
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

CREATE POLICY "Admins, management, and supervisors can update cronograma entries"
ON public.cronograma_entries
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

CREATE POLICY "Admins, management, and supervisors can delete cronograma entries"
ON public.cronograma_entries
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- RLS Policies for cronograma_weeks
CREATE POLICY "Users with appropriate roles can view cronograma weeks"
ON public.cronograma_weeks
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role) OR
  public.has_role(auth.uid(), 'viewer'::public.app_role)
);

CREATE POLICY "Admins, management, and supervisors can insert cronograma weeks"
ON public.cronograma_weeks
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

CREATE POLICY "Admins, management, and supervisors can update cronograma weeks"
ON public.cronograma_weeks
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'management'::public.app_role) OR
  public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- Create trigger for automatic timestamp updates on cronograma_entries
CREATE TRIGGER update_cronograma_entries_updated_at
BEFORE UPDATE ON public.cronograma_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on cronograma_weeks
CREATE TRIGGER update_cronograma_weeks_updated_at
BEFORE UPDATE ON public.cronograma_weeks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();