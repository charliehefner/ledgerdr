
-- Feature 4: Journal Approval Workflow
ALTER TABLE public.journals
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Feature 5: AP/AR Sub-Ledger
CREATE TABLE IF NOT EXISTS public.ap_ar_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL DEFAULT 'invoice',
  direction text NOT NULL,
  contact_name text NOT NULL,
  contact_rnc text,
  document_number text,
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  currency text NOT NULL DEFAULT 'DOP',
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_remaining numeric GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  status text NOT NULL DEFAULT 'open',
  linked_transaction_ids uuid[] DEFAULT '{}',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for ap_ar_documents
ALTER TABLE public.ap_ar_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ap_ar_documents"
  ON public.ap_ar_documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/accountant can insert ap_ar_documents"
  ON public.ap_ar_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "Admin/accountant can update ap_ar_documents"
  ON public.ap_ar_documents FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'management')
  );

CREATE POLICY "Admin can delete ap_ar_documents"
  ON public.ap_ar_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-update timestamp trigger
CREATE TRIGGER update_ap_ar_updated_at
  BEFORE UPDATE ON public.ap_ar_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
