ALTER TABLE public.employee_documents
  ADD COLUMN letter_type text,
  ADD COLUMN letter_metadata jsonb;