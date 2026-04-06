
-- Add sub-line columns to budget_lines
ALTER TABLE public.budget_lines
  ADD COLUMN parent_line_id UUID REFERENCES public.budget_lines(id) ON DELETE CASCADE,
  ADD COLUMN sub_label TEXT;

-- Index for fast child lookups
CREATE INDEX idx_budget_lines_parent ON public.budget_lines(parent_line_id) WHERE parent_line_id IS NOT NULL;
