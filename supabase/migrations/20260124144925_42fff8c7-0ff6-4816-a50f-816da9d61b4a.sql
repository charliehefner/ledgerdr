-- Create table for day labor (jornales) entries
CREATE TABLE public.day_labor_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_date date NOT NULL,
    week_ending_date date NOT NULL, -- Friday of the week
    operation_description text NOT NULL,
    worker_name text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    is_closed boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.day_labor_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins have full access to day labor entries"
ON public.day_labor_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view day labor entries"
ON public.day_labor_entries
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert day labor entries"
ON public.day_labor_entries
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update day labor entries"
ON public.day_labor_entries
FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can delete open day labor entries"
ON public.day_labor_entries
FOR DELETE
USING (has_role(auth.uid(), 'accountant'::app_role) AND is_closed = false);

-- Create index for efficient week queries
CREATE INDEX idx_day_labor_week_ending ON public.day_labor_entries(week_ending_date);

-- Create trigger for updated_at
CREATE TRIGGER update_day_labor_entries_updated_at
BEFORE UPDATE ON public.day_labor_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();