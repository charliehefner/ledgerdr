ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS english_description TEXT,
  ADD COLUMN IF NOT EXISTS spanish_description TEXT;