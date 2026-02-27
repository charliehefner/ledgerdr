
CREATE TABLE public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('project', 'pl')),
  project_code TEXT,
  fiscal_year INT NOT NULL,
  line_code TEXT NOT NULL,
  annual_budget NUMERIC NOT NULL DEFAULT 0,
  current_forecast NUMERIC NOT NULL DEFAULT 0,
  month_1 NUMERIC NOT NULL DEFAULT 0,
  month_2 NUMERIC NOT NULL DEFAULT 0,
  month_3 NUMERIC NOT NULL DEFAULT 0,
  month_4 NUMERIC NOT NULL DEFAULT 0,
  month_5 NUMERIC NOT NULL DEFAULT 0,
  month_6 NUMERIC NOT NULL DEFAULT 0,
  month_7 NUMERIC NOT NULL DEFAULT 0,
  month_8 NUMERIC NOT NULL DEFAULT 0,
  month_9 NUMERIC NOT NULL DEFAULT 0,
  month_10 NUMERIC NOT NULL DEFAULT 0,
  month_11 NUMERIC NOT NULL DEFAULT 0,
  month_12 NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_type, project_code, fiscal_year, line_code)
);

-- Handle null project_code uniqueness for P/L lines
CREATE UNIQUE INDEX budget_lines_pl_unique ON public.budget_lines (budget_type, fiscal_year, line_code) WHERE project_code IS NULL;

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

-- RLS: admin, management, accountant can read
CREATE POLICY "budget_lines_select" ON public.budget_lines
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- RLS: admin, management, accountant can insert
CREATE POLICY "budget_lines_insert" ON public.budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- RLS: admin, management, accountant can update
CREATE POLICY "budget_lines_update" ON public.budget_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- RLS: admin, management can delete
CREATE POLICY "budget_lines_delete" ON public.budget_lines
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management')
  );

-- Updated_at trigger
CREATE TRIGGER update_budget_lines_updated_at
  BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
