ALTER TABLE public.operation_followups 
  ADD COLUMN IF NOT EXISTS alert_days_prior INTEGER NOT NULL DEFAULT 1;