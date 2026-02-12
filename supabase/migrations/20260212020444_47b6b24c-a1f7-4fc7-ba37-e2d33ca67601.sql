
-- New table for follow-up rules
CREATE TABLE public.operation_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_operation_type_id UUID NOT NULL REFERENCES public.operation_types(id),
  followup_text TEXT NOT NULL,
  days_offset INTEGER NOT NULL DEFAULT 3,
  default_driver_id UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add tracking column to cronograma_entries
ALTER TABLE public.cronograma_entries 
  ADD COLUMN source_operation_id UUID REFERENCES public.operations(id);

-- RLS for operation_followups
ALTER TABLE public.operation_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read followup rules"
  ON public.operation_followups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and management can manage followup rules"
  ON public.operation_followups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'management')
    )
  );
