
-- ============================================================
-- 1. Add entity_id to service_entries
-- ============================================================
ALTER TABLE public.service_entries
  ADD COLUMN entity_id UUID REFERENCES public.entities(id);

-- Backfill existing rows with the single active entity
UPDATE public.service_entries
SET entity_id = (SELECT id FROM public.entities WHERE is_active = true LIMIT 1)
WHERE entity_id IS NULL;

-- Make NOT NULL with default
ALTER TABLE public.service_entries
  ALTER COLUMN entity_id SET NOT NULL,
  ALTER COLUMN entity_id SET DEFAULT (public.current_user_entity_id());

CREATE INDEX idx_service_entries_entity_id ON public.service_entries(entity_id);

-- ============================================================
-- 2. Add entity_id to service_providers
-- ============================================================
ALTER TABLE public.service_providers
  ADD COLUMN entity_id UUID REFERENCES public.entities(id);

UPDATE public.service_providers
SET entity_id = (SELECT id FROM public.entities WHERE is_active = true LIMIT 1)
WHERE entity_id IS NULL;

ALTER TABLE public.service_providers
  ALTER COLUMN entity_id SET NOT NULL,
  ALTER COLUMN entity_id SET DEFAULT (public.current_user_entity_id());

CREATE INDEX idx_service_providers_entity_id ON public.service_providers(entity_id);

-- ============================================================
-- 3. Update RLS policies for service_entries (add entity scoping)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view service entries" ON public.service_entries;
CREATE POLICY "Users can view own-entity service entries"
  ON public.service_entries FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

-- ============================================================
-- 4. Update RLS policies for service_providers (add entity scoping)
-- ============================================================
DROP POLICY IF EXISTS "Authorized roles can view service providers" ON public.service_providers;
CREATE POLICY "Users can view own-entity service providers"
  ON public.service_providers FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

-- ============================================================
-- 5. Fix close_day_labor_week: propagate entity_id into transactions
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_day_labor_week(p_week_ending date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_tx_id uuid;
  v_count integer;
  v_entity_id uuid;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM day_labor_entries
  WHERE week_ending_date = p_week_ending
    AND is_closed = false;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay entradas abiertas para la semana al %', p_week_ending;
  END IF;

  -- Get entity_id from the entries (they should all share the same entity)
  SELECT entity_id INTO v_entity_id
  FROM day_labor_entries
  WHERE week_ending_date = p_week_ending
    AND is_closed = false
  LIMIT 1;

  INSERT INTO transactions (
    transaction_date,
    master_acct_code,
    description,
    amount,
    currency,
    transaction_direction,
    is_internal,
    pay_method,
    entity_id
  ) VALUES (
    p_week_ending,
    '7690',
    'Jornales Semana al ' || to_char(p_week_ending, 'DD/MM/YYYY'),
    v_total,
    'DOP',
    'purchase',
    true,
    '84653770-3920-484a-8aa5-3dc8b71a0603',
    v_entity_id
  ) RETURNING id INTO v_tx_id;

  UPDATE day_labor_entries
  SET is_closed = true, updated_at = now()
  WHERE week_ending_date = p_week_ending
    AND is_closed = false;

  RETURN v_tx_id;
END;
$function$;

-- ============================================================
-- 6. Drop the old 6-param register_service_partial_payment overload
-- ============================================================
DROP FUNCTION IF EXISTS public.register_service_partial_payment(uuid, numeric, date, uuid, text, text);

-- ============================================================
-- 7. Fix the 7-param register_service_partial_payment
--    to include entity_id when creating AP documents in the first path
-- ============================================================
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

  SELECT * INTO v_service
  FROM public.service_entries
  WHERE id = p_service_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servicio no encontrado';
  END IF;

  SELECT * INTO v_provider
  FROM public.service_providers
  WHERE id = v_service.provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prestador no encontrado';
  END IF;

  SELECT id, account_name, bank_name, chart_account_id
  INTO v_bank
  FROM public.bank_accounts
  WHERE id = p_bank_account_id AND is_active = true;

  IF NOT FOUND OR v_bank.chart_account_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida o sin cuenta contable asignada';
  END IF;

  IF COALESCE(v_service.committed_amount, v_service.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Defina el monto total del servicio antes de registrar cuotas';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_existing_paid
  FROM public.service_entry_payments
  WHERE service_entry_id = p_service_entry_id;

  IF v_existing_paid + p_amount > COALESCE(v_service.committed_amount, v_service.amount, 0) + 0.005 THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente del servicio';
  END IF;

  IF v_service.ap_document_id IS NULL THEN
    INSERT INTO public.ap_ar_documents (
      direction, document_type, contact_name, contact_rnc,
      document_number, document_date, due_date, currency,
      total_amount, amount_paid, status, notes, created_by, account_id,
      entity_id
    ) VALUES (
      'payable', 'bill', v_provider.name, v_provider.cedula,
      COALESCE(p_ncf, v_service.description),
      v_service.service_date, p_payment_date, v_service.currency,
      COALESCE(v_service.committed_amount, v_service.amount, 0),
      0, 'open',
      COALESCE(v_service.comments, 'Servicio registrado desde RRHH'),
      auth.uid(),
      (SELECT id FROM public.chart_of_accounts WHERE account_code = '2101' AND allow_posting = true AND deleted_at IS NULL LIMIT 1),
      v_service.entity_id
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
    SELECT * INTO v_ap_doc
    FROM public.ap_ar_documents
    WHERE id = v_service.ap_document_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La cuenta por pagar enlazada no fue encontrada';
    END IF;
  END IF;

  SELECT account_code INTO v_ap_account_code
  FROM public.chart_of_accounts
  WHERE id = v_ap_doc.account_id;

  INSERT INTO public.transactions (
    transaction_date, master_acct_code, description, currency,
    amount, pay_method, document, name, rnc, comments,
    exchange_rate, is_void, is_internal, cost_center,
    transaction_direction, entity_id
  ) VALUES (
    p_payment_date,
    COALESCE(v_ap_account_code, '2101'),
    'Pago servicio: ' || COALESCE(v_service.description, 'Servicio') || ' - ' || v_provider.name,
    v_service.currency, p_amount, p_bank_account_id::text,
    COALESCE(p_ncf, 'B11'), v_provider.name, v_provider.cedula,
    p_notes,
    CASE WHEN v_service.currency = 'DOP' THEN 1 ELSE NULL END,
    false, false, 'general', 'purchase',
    v_service.entity_id
  ) RETURNING id, legacy_id INTO v_transaction_id, v_transaction_legacy_id;

  INSERT INTO public.ap_ar_payments (
    document_id, payment_date, amount, payment_method,
    bank_account_id, created_by, notes
  ) VALUES (
    v_ap_doc.id, p_payment_date, p_amount,
    v_bank.account_name, p_bank_account_id, auth.uid(),
    CASE WHEN v_transaction_legacy_id IS NOT NULL THEN 'TX-' || v_transaction_legacy_id::text ELSE p_notes END
  ) RETURNING id INTO v_ap_payment_id;

  v_is_final := p_is_final_payment OR (v_existing_paid + p_amount + 0.005 >= COALESCE(v_service.committed_amount, v_service.amount, 0));

  INSERT INTO public.service_entry_payments (
    service_entry_id, payment_date, amount, bank_account_id,
    transaction_id, ap_payment_id, ncf, notes,
    is_final_payment, created_by
  ) VALUES (
    p_service_entry_id, p_payment_date, p_amount, p_bank_account_id,
    v_transaction_id, v_ap_payment_id, p_ncf, p_notes,
    v_is_final, auth.uid()
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

  UPDATE public.service_entries
  SET paid_amount = v_existing_paid + p_amount,
      remaining_amount = COALESCE(committed_amount, amount, 0) - (v_existing_paid + p_amount),
      settlement_status = CASE WHEN v_is_final THEN 'paid' ELSE 'partial' END,
      is_closed = v_is_final,
      updated_at = now()
  WHERE id = v_service.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'transaction_id', v_transaction_id,
    'ap_document_id', v_ap_doc.id,
    'is_final_payment', v_is_final
  );
END;
$function$;

-- ============================================================
-- 8. Fix generate_due_recurring_journals: propagate entity_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_due_recurring_journals(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_template record;
  v_journal_id uuid;
  v_next date;
BEGIN
  FOR v_template IN
    SELECT t.id, t.template_name, t.description, t.frequency,
           t.next_run_date, t.currency, t.entity_id
    FROM recurring_journal_templates t
    WHERE t.is_active = true
      AND t.next_run_date <= CURRENT_DATE
  LOOP
    INSERT INTO journals (
      journal_date, journal_type, currency, description, posted, created_by, entity_id
    ) VALUES (
      v_template.next_run_date, 'RJ', COALESCE(v_template.currency, 'DOP'),
      v_template.template_name || ' — ' || COALESCE(v_template.description, 'Recurrente'),
      false, p_user_id,
      v_template.entity_id
    ) RETURNING id INTO v_journal_id;

    INSERT INTO journal_lines (journal_id, account_id, project_code, cbs_code, debit, credit, created_by)
    SELECT v_journal_id, tl.account_id, tl.project_code, tl.cbs_code,
           tl.debit, tl.credit, p_user_id
    FROM recurring_journal_template_lines tl
    WHERE tl.template_id = v_template.id;

    IF v_template.frequency = 'biweekly' THEN
      v_next := v_template.next_run_date + interval '14 days';
    ELSE
      v_next := v_template.next_run_date + interval '1 month';
    END IF;

    UPDATE recurring_journal_templates
    SET next_run_date = v_next
    WHERE id = v_template.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ============================================================
-- 9. Fix generate_closing_journal: accept and propagate entity_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_closing_journal(
  p_period_id uuid, p_start_date date, p_end_date date, p_user_id uuid, p_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
  v_retained_earnings_id uuid;
  v_net_income numeric := 0;
  v_bal numeric;
  rec record;
BEGIN
  SELECT id INTO v_retained_earnings_id
  FROM chart_of_accounts
  WHERE deleted_at IS NULL
    AND account_code LIKE '26%'
    AND allow_posting = true
  ORDER BY account_code
  LIMIT 1;

  IF v_retained_earnings_id IS NULL THEN
    SELECT id INTO v_retained_earnings_id
    FROM chart_of_accounts
    WHERE deleted_at IS NULL
      AND account_type = 'equity'
      AND allow_posting = true
    ORDER BY account_code
    LIMIT 1;
  END IF;

  IF v_retained_earnings_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró cuenta de utilidades retenidas (26xx)';
  END IF;

  INSERT INTO journals (
    journal_date, journal_type, currency, description, posted,
    created_by, period_id, entity_id
  ) VALUES (
    p_end_date, 'CLJ', 'DOP',
    'Asiento de cierre — período ' || p_period_id::text,
    false, p_user_id, p_period_id, p_entity_id
  ) RETURNING id INTO v_journal_id;

  FOR rec IN
    SELECT tb.account_code, tb.balance_base, coa.id AS account_id
    FROM trial_balance(p_start_date, p_end_date) tb
    JOIN chart_of_accounts coa ON coa.account_code = tb.account_code AND coa.deleted_at IS NULL
    WHERE tb.account_type IN ('INCOME', 'EXPENSE')
      AND ABS(tb.balance_base) > 0.005
  LOOP
    v_bal := rec.balance_base;
    v_net_income := v_net_income + v_bal;

    INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
    VALUES (
      v_journal_id, rec.account_id,
      CASE WHEN v_bal < 0 THEN ABS(v_bal) ELSE 0 END,
      CASE WHEN v_bal > 0 THEN v_bal ELSE 0 END,
      p_user_id,
      'Cierre ' || rec.account_code
    );
  END LOOP;

  INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
  VALUES (
    v_journal_id, v_retained_earnings_id,
    CASE WHEN v_net_income > 0 THEN v_net_income ELSE 0 END,
    CASE WHEN v_net_income < 0 THEN ABS(v_net_income) ELSE 0 END,
    p_user_id,
    'Utilidades retenidas'
  );

  RETURN v_journal_id;
END;
$function$;
