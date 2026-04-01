ALTER TABLE public.service_entries
ADD COLUMN IF NOT EXISTS ap_document_id uuid,
ADD COLUMN IF NOT EXISTS committed_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'open';

UPDATE public.service_entries
SET committed_amount = COALESCE(amount, 0),
    paid_amount = CASE WHEN is_closed THEN COALESCE(amount, 0) ELSE 0 END,
    remaining_amount = GREATEST(COALESCE(amount, 0) - CASE WHEN is_closed THEN COALESCE(amount, 0) ELSE 0 END, 0),
    settlement_status = CASE
      WHEN is_closed THEN 'paid'
      WHEN COALESCE(amount, 0) = 0 THEN 'draft'
      ELSE 'open'
    END
WHERE committed_amount = 0
   OR remaining_amount = 0
   OR settlement_status = 'open';

ALTER TABLE public.service_entries
ADD CONSTRAINT service_entries_ap_document_id_fkey
FOREIGN KEY (ap_document_id) REFERENCES public.ap_ar_documents(id) ON DELETE SET NULL;

ALTER TABLE public.service_entries
ADD CONSTRAINT service_entries_settlement_status_check
CHECK (settlement_status IN ('draft', 'open', 'partial', 'paid', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_service_entries_ap_document_id
ON public.service_entries(ap_document_id);

CREATE TABLE IF NOT EXISTS public.service_entry_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_entry_id uuid NOT NULL REFERENCES public.service_entries(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ap_payment_id uuid REFERENCES public.ap_ar_payments(id) ON DELETE SET NULL,
  ncf text,
  notes text,
  is_final_payment boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT service_entry_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_service_entry_payments_service_entry_id
ON public.service_entry_payments(service_entry_id, payment_date DESC, created_at DESC);

ALTER TABLE public.service_entry_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service entry payments"
ON public.service_entry_payments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/mgmt/acct can insert service entry payments"
ON public.service_entry_payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'management')
  OR public.has_role(auth.uid(), 'accountant')
);

CREATE POLICY "Admin/mgmt/acct can update service entry payments"
ON public.service_entry_payments
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'management')
  OR public.has_role(auth.uid(), 'accountant')
);

CREATE POLICY "Admin/mgmt can delete service entry payments"
ON public.service_entry_payments
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'management')
);

CREATE TRIGGER update_service_entry_payments_updated_at
BEFORE UPDATE ON public.service_entry_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_service_entry_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_entry_id uuid;
  v_committed numeric;
  v_paid numeric;
BEGIN
  v_service_entry_id := COALESCE(NEW.service_entry_id, OLD.service_entry_id);

  SELECT COALESCE(committed_amount, amount, 0)
  INTO v_committed
  FROM public.service_entries
  WHERE id = v_service_entry_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.service_entry_payments
  WHERE service_entry_id = v_service_entry_id;

  UPDATE public.service_entries
  SET paid_amount = v_paid,
      remaining_amount = GREATEST(v_committed - v_paid, 0),
      settlement_status = CASE
        WHEN v_committed <= 0 THEN 'draft'
        WHEN v_paid <= 0 THEN 'open'
        WHEN v_paid + 0.005 >= v_committed THEN 'paid'
        ELSE 'partial'
      END,
      is_closed = CASE WHEN v_paid + 0.005 >= v_committed AND v_committed > 0 THEN true ELSE false END,
      updated_at = now()
  WHERE id = v_service_entry_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER sync_service_entry_totals_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.service_entry_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_entry_totals();

CREATE OR REPLACE FUNCTION public.register_service_partial_payment(
  p_service_entry_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_bank_account_id uuid,
  p_ncf text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_is_final_payment boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service public.service_entries%ROWTYPE;
  v_provider public.service_providers%ROWTYPE;
  v_bank RECORD;
  v_ap_doc public.ap_ar_documents%ROWTYPE;
  v_ap_account_code text;
  v_transaction_id uuid;
  v_transaction_legacy_id integer;
  v_ap_payment_id uuid;
  v_payment_id uuid;
  v_existing_paid numeric;
  v_is_final boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'accountant')
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para registrar pagos parciales';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  SELECT *
  INTO v_service
  FROM public.service_entries
  WHERE id = p_service_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado';
  END IF;

  SELECT *
  INTO v_provider
  FROM public.service_providers
  WHERE id = v_service.provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prestador no encontrado';
  END IF;

  SELECT id, account_name, bank_name, chart_account_id
  INTO v_bank
  FROM public.bank_accounts
  WHERE id = p_bank_account_id
    AND is_active = true;

  IF NOT FOUND OR v_bank.chart_account_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida o sin cuenta contable asignada';
  END IF;

  IF COALESCE(v_service.committed_amount, v_service.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Defina el monto total del servicio antes de registrar cuotas';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_existing_paid
  FROM public.service_entry_payments
  WHERE service_entry_id = p_service_entry_id;

  IF v_existing_paid + p_amount > COALESCE(v_service.committed_amount, v_service.amount, 0) + 0.005 THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente del servicio';
  END IF;

  IF v_service.ap_document_id IS NULL THEN
    INSERT INTO public.ap_ar_documents (
      direction,
      document_type,
      contact_name,
      contact_rnc,
      document_number,
      document_date,
      due_date,
      currency,
      total_amount,
      amount_paid,
      balance_remaining,
      status,
      notes,
      created_by,
      account_id
    ) VALUES (
      'payable',
      'bill',
      v_provider.name,
      v_provider.cedula,
      COALESCE(p_ncf, v_service.description),
      v_service.service_date,
      p_payment_date,
      v_service.currency,
      COALESCE(v_service.committed_amount, v_service.amount, 0),
      0,
      COALESCE(v_service.committed_amount, v_service.amount, 0),
      'open',
      COALESCE(v_service.comments, 'Servicio registrado desde RRHH'),
      auth.uid(),
      (SELECT id FROM public.chart_of_accounts WHERE account_code = '2101' AND allow_posting = true AND deleted_at IS NULL LIMIT 1)
    ) RETURNING * INTO v_ap_doc;

    UPDATE public.service_entries
    SET ap_document_id = v_ap_doc.id,
        committed_amount = COALESCE(committed_amount, amount, 0),
        remaining_amount = COALESCE(committed_amount, amount, 0),
        settlement_status = CASE WHEN COALESCE(committed_amount, amount, 0) > 0 THEN 'open' ELSE 'draft' END,
        updated_at = now()
    WHERE id = v_service.id;

    SELECT * INTO v_service FROM public.service_entries WHERE id = p_service_entry_id;
  ELSE
    SELECT *
    INTO v_ap_doc
    FROM public.ap_ar_documents
    WHERE id = v_service.ap_document_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La cuenta por pagar enlazada no fue encontrada';
    END IF;
  END IF;

  SELECT account_code
  INTO v_ap_account_code
  FROM public.chart_of_accounts
  WHERE id = v_ap_doc.account_id;

  INSERT INTO public.transactions (
    transaction_date,
    master_acct_code,
    description,
    currency,
    amount,
    pay_method,
    document,
    name,
    rnc,
    comments,
    exchange_rate,
    is_void,
    is_internal,
    cost_center,
    transaction_direction
  ) VALUES (
    p_payment_date,
    COALESCE(v_ap_account_code, '2101'),
    'Pago servicio: ' || COALESCE(v_service.description, 'Servicio') || ' - ' || v_provider.name,
    v_service.currency,
    p_amount,
    p_bank_account_id::text,
    COALESCE(p_ncf, 'B11'),
    v_provider.name,
    v_provider.cedula,
    p_notes,
    CASE WHEN v_service.currency = 'DOP' THEN 1 ELSE NULL END,
    false,
    false,
    'general',
    'purchase'
  ) RETURNING id, legacy_id INTO v_transaction_id, v_transaction_legacy_id;

  INSERT INTO public.ap_ar_payments (
    document_id,
    payment_date,
    amount,
    payment_method,
    bank_account_id,
    created_by,
    notes
  ) VALUES (
    v_ap_doc.id,
    p_payment_date,
    p_amount,
    v_bank.account_name,
    p_bank_account_id,
    auth.uid(),
    CASE WHEN v_transaction_legacy_id IS NOT NULL THEN 'TX-' || v_transaction_legacy_id::text ELSE p_notes END
  ) RETURNING id INTO v_ap_payment_id;

  v_is_final := p_is_final_payment OR (v_existing_paid + p_amount + 0.005 >= COALESCE(v_service.committed_amount, v_service.amount, 0));

  INSERT INTO public.service_entry_payments (
    service_entry_id,
    payment_date,
    amount,
    bank_account_id,
    transaction_id,
    ap_payment_id,
    ncf,
    notes,
    is_final_payment,
    created_by
  ) VALUES (
    p_service_entry_id,
    p_payment_date,
    p_amount,
    p_bank_account_id,
    v_transaction_id,
    v_ap_payment_id,
    p_ncf,
    p_notes,
    v_is_final,
    auth.uid()
  ) RETURNING id INTO v_payment_id;

  UPDATE public.ap_ar_documents
  SET amount_paid = ROUND((COALESCE(amount_paid, 0) + p_amount)::numeric, 2),
      status = CASE
        WHEN COALESCE(amount_paid, 0) + p_amount + 0.005 >= total_amount THEN 'paid'
        WHEN COALESCE(amount_paid, 0) + p_amount > 0 THEN 'partial'
        ELSE 'open'
      END,
      updated_at = now()
  WHERE id = v_ap_doc.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'transaction_id', v_transaction_id,
    'ap_document_id', v_ap_doc.id,
    'is_final_payment', v_is_final
  );
END;
$function$;