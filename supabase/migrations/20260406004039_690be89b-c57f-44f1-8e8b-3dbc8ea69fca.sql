-- Drop the old unique constraint that doesn't account for sub-lines
ALTER TABLE public.budget_lines
  DROP CONSTRAINT budget_lines_budget_type_project_code_fiscal_year_line_code_key;

-- Re-create with parent_line_id and sub_label included so sub-lines don't conflict
CREATE UNIQUE INDEX budget_lines_unique_idx
  ON public.budget_lines (budget_type, COALESCE(project_code, ''), fiscal_year, line_code, COALESCE(parent_line_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(sub_label, ''));