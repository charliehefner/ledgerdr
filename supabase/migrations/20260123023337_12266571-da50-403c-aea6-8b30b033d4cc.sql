-- Create table for local transaction edits (corrections)
CREATE TABLE public.transaction_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  document TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same pattern as transaction_attachments)
CREATE POLICY "Admins have full access to edits"
ON public.transaction_edits
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view edits"
ON public.transaction_edits
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert edits"
ON public.transaction_edits
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update edits"
ON public.transaction_edits
FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_transaction_edits_updated_at
BEFORE UPDATE ON public.transaction_edits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();