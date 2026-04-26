-- 1. Add account 2180 to Chart of Accounts (idempotent)
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, allow_posting, currency, base_currency, spanish_description, english_description)
VALUES ('2180', 'Acumulaciones por Pagar', 'LIABILITY', true, 'DOP', 'DOP',
        'Acumulaciones por Pagar', 'Accrued Liabilities')
ON CONFLICT (account_code) DO NOTHING;

-- 2. accrual_entries table
CREATE TABLE public.accrual_entries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id              uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  accrual_date           date NOT NULL,
  reversal_date          date NOT NULL,
  expense_account_id     uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  liability_account_id   uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  amount                 numeric(14,2) NOT NULL CHECK (amount > 0),
  currency               text NOT NULL DEFAULT 'DOP',
  cost_center            text,
  description            text NOT NULL,
  reference              text,
  accrual_journal_id     uuid REFERENCES public.journals(id),
  reversal_journal_id    uuid REFERENCES public.journals(id),
  status                 text NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','reversed','cancelled')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (expense_account_id <> liability_account_id),
  CHECK (reversal_date >= accrual_date)
);

CREATE INDEX idx_accrual_entries_entity_date ON public.accrual_entries (entity_id, accrual_date DESC);
CREATE INDEX idx_accrual_entries_reversal_journal ON public.accrual_entries (reversal_journal_id) WHERE reversal_journal_id IS NOT NULL;
CREATE INDEX idx_accrual_entries_status ON public.accrual_entries (status);

-- 3. updated_at trigger (reuse standard pattern)
CREATE OR REPLACE FUNCTION public.touch_accrual_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_accrual_entries_updated_at
  BEFORE UPDATE ON public.accrual_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_accrual_entries_updated_at();

-- 4. RLS
ALTER TABLE public.accrual_entries ENABLE ROW LEVEL SECURITY;

-- Read: admin / accountant / management / supervisor
CREATE POLICY "accrual_entries_read"
  ON public.accrual_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- Insert: admin / accountant
CREATE POLICY "accrual_entries_insert"
  ON public.accrual_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

-- Update: admin / accountant
CREATE POLICY "accrual_entries_update"
  ON public.accrual_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

-- No DELETE policy → all DELETE attempts blocked. Use status='cancelled' instead.

-- 5. Trigger: flip status to 'reversed' when reversal_journal becomes posted
CREATE OR REPLACE FUNCTION public.flip_accrual_status_on_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.posted = true AND (OLD.posted IS DISTINCT FROM true) THEN
    UPDATE public.accrual_entries
       SET status = 'reversed', updated_at = now()
     WHERE reversal_journal_id = NEW.id
       AND status = 'scheduled';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_flip_accrual_status_on_post
  AFTER UPDATE OF posted ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.flip_accrual_status_on_post();