-- Create transaction audit log table
CREATE TABLE IF NOT EXISTS public.transaction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT
);

-- Enable RLS
ALTER TABLE public.transaction_audit_log ENABLE ROW LEVEL SECURITY;

-- Read access for admin, management, accountant
CREATE POLICY "Admin full access" ON public.transaction_audit_log
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Management can view audit log" ON public.transaction_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'management'));

CREATE POLICY "Accountant can view audit log" ON public.transaction_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

-- Trigger function to log field changes
CREATE OR REPLACE FUNCTION public.log_transaction_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_fields TEXT[] := ARRAY['amount','description','transaction_date','master_acct_code','cbs_code','project_code','is_void','void_reason','cost_center'];
  v_field TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  FOREACH v_field IN ARRAY v_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_old, v_new
      USING OLD, NEW;

    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.transaction_audit_log (transaction_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, v_user_id, v_field, v_old, v_new);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
CREATE TRIGGER trg_log_transaction_changes
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_transaction_changes();

-- Index for fast lookups
CREATE INDEX idx_transaction_audit_log_tx_id ON public.transaction_audit_log(transaction_id);