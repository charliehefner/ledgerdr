
-- ============================================================================
-- 1. M:N payment applications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ap_ar_payment_applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES public.ap_ar_payments(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES public.ap_ar_documents(id) ON DELETE CASCADE,
  amount       numeric NOT NULL CHECK (amount > 0),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

CREATE INDEX IF NOT EXISTS idx_apar_pa_payment  ON public.ap_ar_payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_apar_pa_document ON public.ap_ar_payment_applications(document_id);

ALTER TABLE public.ap_ar_payment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access apa"
  ON public.ap_ar_payment_applications
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'admin'::app_role, d.entity_id)
  ));

CREATE POLICY "Management full access apa"
  ON public.ap_ar_payment_applications
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'management'::app_role, d.entity_id)
  ));

CREATE POLICY "Accountant full access apa"
  ON public.ap_ar_payment_applications
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND has_role_for_entity(auth.uid(), 'accountant'::app_role, d.entity_id)
  ));

CREATE POLICY "Read access apa"
  ON public.ap_ar_payment_applications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ap_ar_documents d
    WHERE d.id = ap_ar_payment_applications.document_id
      AND (
        has_role_for_entity(auth.uid(), 'supervisor'::app_role, d.entity_id) OR
        has_role_for_entity(auth.uid(), 'viewer'::app_role,    d.entity_id)
      )
  ));

-- ============================================================================
-- 2. Backfill from existing payments (one-time)
-- ============================================================================
INSERT INTO public.ap_ar_payment_applications (payment_id, document_id, amount, created_at, created_by)
SELECT p.id, p.document_id, p.amount, p.created_at, p.created_by
FROM public.ap_ar_payments p
WHERE NOT EXISTS (
  SELECT 1 FROM public.ap_ar_payment_applications a WHERE a.payment_id = p.id
);

-- ============================================================================
-- 3. Recompute helper: applications are now the source of truth for payments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recompute_ap_ar_document_balance(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total          numeric;
  v_current_status text;
  v_apps           numeric;
  v_alloc_invoice  numeric;
  v_alloc_advance  numeric;
  v_paid           numeric;
  v_new_status     text;
BEGIN
  IF p_document_id IS NULL THEN RETURN; END IF;

  SELECT total_amount, status
    INTO v_total, v_current_status
  FROM ap_ar_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_current_status = 'void' THEN RETURN; END IF;

  -- Sum applied payments (M:N table)
  SELECT COALESCE(SUM(amount), 0) INTO v_apps
  FROM ap_ar_payment_applications
  WHERE document_id = p_document_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_invoice
  FROM advance_allocations
  WHERE invoice_doc_id = p_document_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_advance
  FROM advance_allocations
  WHERE advance_doc_id = p_document_id;

  v_paid := ROUND(v_apps + v_alloc_invoice + v_alloc_advance, 2);

  IF v_paid >= v_total - 0.005 THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0.005 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'open';
  END IF;

  UPDATE ap_ar_documents
  SET amount_paid = v_paid,
      status      = v_new_status,
      updated_at  = now()
  WHERE id = p_document_id;
END;
$function$;

-- ============================================================================
-- 4. Trigger on applications table to keep balances in sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_recompute_apar_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_ap_ar_document_balance(OLD.document_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_ap_ar_document_balance(NEW.document_id);
    IF NEW.document_id <> OLD.document_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.document_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recompute_ap_ar_document_balance(NEW.document_id);
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS recompute_apar_on_application ON public.ap_ar_payment_applications;
CREATE TRIGGER recompute_apar_on_application
AFTER INSERT OR UPDATE OR DELETE ON public.ap_ar_payment_applications
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_apar_on_application();

-- ============================================================================
-- 5. Update apply_ap_ar_payment to also write into the application table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_ap_ar_payment(
  p_document_id     uuid,
  p_payment_date    date,
  p_amount          numeric,
  p_bank_account_id uuid,
  p_user_id         uuid    DEFAULT NULL,
  p_exchange_rate   numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc                ap_ar_documents%ROWTYPE;
  v_bank_chart_account uuid;
  v_bank_name          text;
  v_ap_ar_account_id   uuid;
  v_ap_ar_account_code text;
  v_journal_id         uuid;
  v_fx_journal_id      uuid;
  v_fx_account_id      uuid;
  v_journal_type       text;
  v_is_payable         boolean;
  v_tx_id              uuid;
  v_tx_legacy          bigint;
  v_payment_id         uuid;
  v_description        text;
  v_currency_pair      text;
  v_rate               numeric;
  v_doc_rate           numeric;
  v_fx_diff_dop        numeric;
BEGIN
  IF p_document_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR p_bank_account_id IS NULL OR p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos para apply_ap_ar_payment';
  END IF;

  SELECT * INTO v_doc FROM ap_ar_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento A/P-A/R no encontrado'; END IF;
  IF v_doc.status IN ('paid','void') THEN
    RAISE EXCEPTION 'No se puede registrar pago: documento %', v_doc.status;
  END IF;
  IF p_amount > v_doc.balance_remaining + 0.005 THEN
    RAISE EXCEPTION 'El monto excede el saldo pendiente';
  END IF;

  v_is_payable   := (v_doc.direction = 'payable');
  v_journal_type := CASE WHEN v_is_payable THEN 'CDJ' ELSE 'CRJ' END;

  SELECT chart_account_id, account_name
    INTO v_bank_chart_account, v_bank_name
  FROM bank_accounts WHERE id = p_bank_account_id;
  IF v_bank_chart_account IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria sin cuenta contable enlazada';
  END IF;

  v_ap_ar_account_id := v_doc.account_id;
  IF v_ap_ar_account_id IS NULL THEN
    SELECT id, account_code INTO v_ap_ar_account_id, v_ap_ar_account_code
    FROM chart_of_accounts
    WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
      AND allow_posting = true AND deleted_at IS NULL
    LIMIT 1;
    IF v_ap_ar_account_id IS NULL THEN RAISE EXCEPTION 'Cuenta contable A/P-A/R no encontrada'; END IF;
  ELSE
    SELECT account_code INTO v_ap_ar_account_code
    FROM chart_of_accounts WHERE id = v_ap_ar_account_id;
  END IF;

  v_description := CASE WHEN v_is_payable THEN 'Pago a ' ELSE 'Cobro de ' END
                || v_doc.contact_name || ' — '
                || COALESCE(v_doc.document_number, 'sin número');

  IF v_doc.currency <> 'DOP' THEN
    IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
      v_rate := p_exchange_rate;
    ELSE
      v_currency_pair := v_doc.currency || '/DOP';
      SELECT sell_rate INTO v_rate FROM exchange_rates
        WHERE currency_pair = v_currency_pair ORDER BY rate_date DESC LIMIT 1;
      IF v_rate IS NULL THEN
        v_currency_pair := v_doc.currency || '_DOP';
        SELECT sell_rate INTO v_rate FROM exchange_rates
          WHERE currency_pair = v_currency_pair ORDER BY rate_date DESC LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1);
    END IF;
  ELSE
    v_rate := 1;
  END IF;

  v_journal_id := public.create_journal_from_transaction(
    NULL, p_payment_date, v_description, p_user_id, v_journal_type
  );
  IF v_doc.currency <> 'DOP' THEN
    UPDATE journals SET currency = v_doc.currency, exchange_rate = v_rate WHERE id = v_journal_id;
  END IF;

  IF v_is_payable THEN
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (v_journal_id, v_ap_ar_account_id, p_amount, 0, 'Pago a ' || v_doc.contact_name),
      (v_journal_id, v_bank_chart_account, 0, p_amount, 'Pago desde ' || v_bank_name);
  ELSE
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (v_journal_id, v_bank_chart_account, p_amount, 0, 'Cobro de ' || v_doc.contact_name),
      (v_journal_id, v_ap_ar_account_id, 0, p_amount, 'Cobro de ' || v_doc.contact_name);
  END IF;

  -- Realized FX gain/loss
  IF v_doc.currency <> 'DOP' AND v_doc.exchange_rate_used IS NOT NULL AND v_doc.exchange_rate_used > 0 THEN
    v_doc_rate    := v_doc.exchange_rate_used;
    v_fx_diff_dop := ROUND(p_amount * (v_rate - v_doc_rate), 2);
    IF abs(v_fx_diff_dop) >= 0.01 THEN
      SELECT id INTO v_fx_account_id FROM chart_of_accounts
      WHERE account_code = '8510' AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
      IF v_fx_account_id IS NULL THEN RAISE EXCEPTION 'Cuenta 8510 (Diferencia Cambiaria) no encontrada'; END IF;

      INSERT INTO journals (journal_date, description, currency, exchange_rate,
        posted, posted_at, posted_by, journal_type, created_by)
      VALUES (p_payment_date,
        'FX realizado — ' || v_description
          || ' (rate doc ' || v_doc_rate::text || ' → pago ' || v_rate::text || ')',
        'DOP', 1, true, now(), p_user_id, 'GJ', p_user_id)
      RETURNING id INTO v_fx_journal_id;

      IF (v_is_payable AND v_fx_diff_dop > 0) OR (NOT v_is_payable AND v_fx_diff_dop < 0) THEN
        INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
          (v_fx_journal_id, v_ap_ar_account_id, abs(v_fx_diff_dop), 0, 'Ajuste FX cuenta de control'),
          (v_fx_journal_id, v_fx_account_id, 0, abs(v_fx_diff_dop), 'Pérdida cambiaria realizada');
      ELSE
        INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
          (v_fx_journal_id, v_fx_account_id, abs(v_fx_diff_dop), 0, 'Ganancia cambiaria realizada'),
          (v_fx_journal_id, v_ap_ar_account_id, 0, abs(v_fx_diff_dop), 'Ajuste FX cuenta de control');
      END IF;
    END IF;
  END IF;

  INSERT INTO transactions (
    transaction_date, description, amount, currency,
    pay_method, name, master_acct_code,
    transaction_direction, is_internal, cost_center, exchange_rate
  ) VALUES (
    p_payment_date, v_description, p_amount, v_doc.currency,
    p_bank_account_id::text, v_doc.contact_name,
    COALESCE(v_ap_ar_account_code, CASE WHEN v_is_payable THEN '2101' ELSE '1210' END),
    CASE WHEN v_is_payable THEN 'purchase' ELSE 'sale' END,
    false, 'general', v_rate
  )
  RETURNING id, legacy_id INTO v_tx_id, v_tx_legacy;

  UPDATE journals SET transaction_source_id = v_tx_id WHERE id = v_journal_id;

  INSERT INTO ap_ar_payments (
    document_id, payment_date, amount, payment_method,
    bank_account_id, journal_id, created_by, notes
  ) VALUES (
    p_document_id, p_payment_date, p_amount, v_bank_name,
    p_bank_account_id, v_journal_id, p_user_id, 'TX-' || v_tx_legacy::text
  ) RETURNING id INTO v_payment_id;

  -- Mirror into M:N application table
  INSERT INTO ap_ar_payment_applications (payment_id, document_id, amount, created_by)
  VALUES (v_payment_id, p_document_id, p_amount, p_user_id);

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'journal_id', v_journal_id,
    'fx_journal_id', v_fx_journal_id,
    'fx_diff_dop', COALESCE(v_fx_diff_dop, 0),
    'transaction_id', v_tx_id,
    'transaction_legacy_id', v_tx_legacy
  );
END;
$function$;

-- ============================================================================
-- 6. Multi-document apply: one bank movement, many invoices/advances
--    Input: p_applications jsonb := [{"document_id":"…","amount":1234.5}, …]
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_ap_ar_payment_multi(
  p_applications    jsonb,
  p_payment_date    date,
  p_bank_account_id uuid,
  p_user_id         uuid    DEFAULT NULL,
  p_exchange_rate   numeric DEFAULT NULL,
  p_notes           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app                 jsonb;
  v_doc                 ap_ar_documents%ROWTYPE;
  v_bank_chart_account  uuid;
  v_bank_name           text;
  v_journal_id          uuid;
  v_journal_type        text;
  v_payment_id          uuid;
  v_tx_id               uuid;
  v_tx_legacy           bigint;
  v_total               numeric := 0;
  v_currency            text;
  v_direction           text;
  v_is_payable          boolean;
  v_count               int;
  v_amount              numeric;
  v_doc_id              uuid;
  v_apar_account_id     uuid;
  v_apar_account_code   text;
  v_first_contact       text;
  v_description         text;
  v_rate                numeric := 1;
  v_currency_pair       text;
  v_master_code         text;
BEGIN
  IF p_applications IS NULL OR jsonb_typeof(p_applications) <> 'array'
     OR jsonb_array_length(p_applications) = 0 THEN
    RAISE EXCEPTION 'Lista de aplicaciones vacía';
  END IF;
  v_count := jsonb_array_length(p_applications);

  IF p_bank_account_id IS NULL OR p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;

  SELECT chart_account_id, account_name
    INTO v_bank_chart_account, v_bank_name
  FROM bank_accounts WHERE id = p_bank_account_id;
  IF v_bank_chart_account IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria sin cuenta contable enlazada';
  END IF;

  -- Validate all docs share direction + currency, sum total, capture first contact
  FOR v_app IN SELECT * FROM jsonb_array_elements(p_applications) LOOP
    v_doc_id := (v_app->>'document_id')::uuid;
    v_amount := (v_app->>'amount')::numeric;
    IF v_doc_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Aplicación inválida en lista';
    END IF;
    SELECT * INTO v_doc FROM ap_ar_documents WHERE id = v_doc_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Documento % no encontrado', v_doc_id; END IF;
    IF v_doc.status IN ('paid','void') THEN
      RAISE EXCEPTION 'Documento % ya está %', COALESCE(v_doc.document_number,v_doc_id::text), v_doc.status;
    END IF;
    IF v_amount > v_doc.balance_remaining + 0.005 THEN
      RAISE EXCEPTION 'Monto % excede el saldo del documento %', v_amount, COALESCE(v_doc.document_number,v_doc_id::text);
    END IF;

    IF v_currency IS NULL THEN
      v_currency      := v_doc.currency;
      v_direction     := v_doc.direction;
      v_first_contact := v_doc.contact_name;
    ELSE
      IF v_doc.currency <> v_currency THEN
        RAISE EXCEPTION 'Todos los documentos deben tener la misma moneda';
      END IF;
      IF v_doc.direction <> v_direction THEN
        RAISE EXCEPTION 'No se pueden mezclar cobros y pagos en una misma operación';
      END IF;
    END IF;

    v_total := v_total + v_amount;
  END LOOP;

  v_is_payable := (v_direction = 'payable');
  v_journal_type := CASE WHEN v_is_payable THEN 'CDJ' ELSE 'CRJ' END;

  -- FX rate for non-DOP
  IF v_currency <> 'DOP' THEN
    IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
      v_rate := p_exchange_rate;
    ELSE
      v_currency_pair := v_currency || '/DOP';
      SELECT sell_rate INTO v_rate FROM exchange_rates
        WHERE currency_pair = v_currency_pair ORDER BY rate_date DESC LIMIT 1;
      IF v_rate IS NULL THEN
        v_currency_pair := v_currency || '_DOP';
        SELECT sell_rate INTO v_rate FROM exchange_rates
          WHERE currency_pair = v_currency_pair ORDER BY rate_date DESC LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1);
    END IF;
  END IF;

  v_description := CASE WHEN v_is_payable THEN 'Pago múltiple' ELSE 'Cobro múltiple' END
                   || ' — ' || v_count::text || ' documento(s)'
                   || COALESCE(' — ' || p_notes, '');

  -- 1) Single journal header
  v_journal_id := public.create_journal_from_transaction(
    NULL, p_payment_date, v_description, p_user_id, v_journal_type
  );
  IF v_currency <> 'DOP' THEN
    UPDATE journals SET currency = v_currency, exchange_rate = v_rate WHERE id = v_journal_id;
  END IF;

  -- 2) One control line per application
  FOR v_app IN SELECT * FROM jsonb_array_elements(p_applications) LOOP
    v_doc_id := (v_app->>'document_id')::uuid;
    v_amount := (v_app->>'amount')::numeric;
    SELECT * INTO v_doc FROM ap_ar_documents WHERE id = v_doc_id;

    v_apar_account_id := v_doc.account_id;
    IF v_apar_account_id IS NULL THEN
      SELECT id, account_code INTO v_apar_account_id, v_apar_account_code
      FROM chart_of_accounts
      WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
        AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
    ELSE
      SELECT account_code INTO v_apar_account_code FROM chart_of_accounts WHERE id = v_apar_account_id;
    END IF;
    IF v_apar_account_id IS NULL THEN RAISE EXCEPTION 'Cuenta A/P-A/R no encontrada para %', v_doc.contact_name; END IF;

    IF v_master_code IS NULL THEN v_master_code := v_apar_account_code; END IF;

    IF v_is_payable THEN
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_apar_account_id, v_amount, 0,
              'Pago a ' || v_doc.contact_name || ' — ' || COALESCE(v_doc.document_number,'s/n'));
    ELSE
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_apar_account_id, 0, v_amount,
              'Cobro de ' || v_doc.contact_name || ' — ' || COALESCE(v_doc.document_number,'s/n'));
    END IF;
  END LOOP;

  -- 3) Bank line (offsetting total)
  IF v_is_payable THEN
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_bank_chart_account, 0, v_total, 'Pago desde ' || v_bank_name);
  ELSE
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_bank_chart_account, v_total, 0, 'Cobro a ' || v_bank_name);
  END IF;

  -- 4) Mirror transaction (single)
  INSERT INTO transactions (
    transaction_date, description, amount, currency,
    pay_method, name, master_acct_code,
    transaction_direction, is_internal, cost_center, exchange_rate
  ) VALUES (
    p_payment_date, v_description, v_total, v_currency,
    p_bank_account_id::text, v_first_contact,
    COALESCE(v_master_code, CASE WHEN v_is_payable THEN '2101' ELSE '1210' END),
    CASE WHEN v_is_payable THEN 'purchase' ELSE 'sale' END,
    false, 'general', v_rate
  ) RETURNING id, legacy_id INTO v_tx_id, v_tx_legacy;

  UPDATE journals SET transaction_source_id = v_tx_id WHERE id = v_journal_id;

  -- 5) ONE payment row + N application rows
  INSERT INTO ap_ar_payments (
    document_id, payment_date, amount, payment_method,
    bank_account_id, journal_id, created_by, notes
  ) VALUES (
    -- For backward compatibility: link to the first doc; applications carry the truth
    ((p_applications->0)->>'document_id')::uuid,
    p_payment_date, v_total, v_bank_name,
    p_bank_account_id, v_journal_id, p_user_id,
    'TX-' || v_tx_legacy::text || ' (multi:' || v_count::text || ')'
  ) RETURNING id INTO v_payment_id;

  FOR v_app IN SELECT * FROM jsonb_array_elements(p_applications) LOOP
    INSERT INTO ap_ar_payment_applications (payment_id, document_id, amount, created_by, notes)
    VALUES (
      v_payment_id,
      (v_app->>'document_id')::uuid,
      (v_app->>'amount')::numeric,
      p_user_id,
      p_notes
    );
  END LOOP;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'journal_id', v_journal_id,
    'transaction_id', v_tx_id,
    'transaction_legacy_id', v_tx_legacy,
    'total', v_total,
    'currency', v_currency,
    'count', v_count
  );
END;
$function$;

-- ============================================================================
-- 7. Unified manual document creation RPC (collapses path A)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_ap_ar_document(
  p_direction         text,
  p_document_type     text,
  p_contact_name      text,
  p_contact_rnc       text    DEFAULT NULL,
  p_document_number   text    DEFAULT NULL,
  p_document_date     date    DEFAULT CURRENT_DATE,
  p_due_date          date    DEFAULT NULL,
  p_currency          text    DEFAULT 'DOP',
  p_total_amount      numeric DEFAULT 0,
  p_notes             text    DEFAULT NULL,
  p_account_id        uuid    DEFAULT NULL,
  p_supplier_id       uuid    DEFAULT NULL,
  p_contract_id       uuid    DEFAULT NULL,
  p_entity_id         uuid    DEFAULT NULL,
  p_offset_account_id uuid    DEFAULT NULL,
  p_post_journal      boolean DEFAULT false,
  p_exchange_rate     numeric DEFAULT NULL,
  p_user_id           uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_id          uuid;
  v_journal_id      uuid;
  v_apar_account_id uuid;
  v_is_payable      boolean;
  v_journal_type    text;
  v_description     text;
  v_rate            numeric := COALESCE(p_exchange_rate, 1);
  v_apar_dop        numeric;
BEGIN
  IF p_direction NOT IN ('payable','receivable') THEN
    RAISE EXCEPTION 'direction debe ser payable o receivable';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'total_amount debe ser positivo';
  END IF;
  IF COALESCE(TRIM(p_contact_name),'') = '' THEN
    RAISE EXCEPTION 'contact_name es requerido';
  END IF;

  v_is_payable := (p_direction = 'payable');

  -- Resolve A/P or A/R control account
  v_apar_account_id := p_account_id;
  IF v_apar_account_id IS NULL THEN
    SELECT id INTO v_apar_account_id FROM chart_of_accounts
    WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
      AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
  END IF;

  INSERT INTO ap_ar_documents (
    direction, document_type, contact_name, contact_rnc,
    document_number, document_date, due_date, currency,
    total_amount, amount_paid, status, notes,
    account_id, entity_id, supplier_id, contract_id,
    exchange_rate_used, total_amount_dop, created_by
  ) VALUES (
    p_direction, p_document_type,
    TRIM(p_contact_name), NULLIF(TRIM(COALESCE(p_contact_rnc,'')),''),
    NULLIF(TRIM(COALESCE(p_document_number,'')),''),
    p_document_date, p_due_date, p_currency,
    p_total_amount, 0, 'open', p_notes,
    v_apar_account_id, p_entity_id, p_supplier_id, p_contract_id,
    CASE WHEN p_currency <> 'DOP' THEN v_rate END,
    CASE WHEN p_currency <> 'DOP' THEN ROUND(p_total_amount * v_rate, 2) ELSE p_total_amount END,
    p_user_id
  )
  RETURNING id INTO v_doc_id;

  -- Optional journal (requires offset account)
  IF p_post_journal AND p_offset_account_id IS NOT NULL THEN
    IF v_apar_account_id IS NULL THEN
      RAISE EXCEPTION 'Cuenta A/P-A/R no resuelta';
    END IF;

    v_journal_type := CASE WHEN v_is_payable THEN 'PJ' ELSE 'SJ' END;
    v_description  := CASE WHEN v_is_payable THEN 'Factura de ' ELSE 'Factura a ' END
                      || p_contact_name || COALESCE(' — ' || p_document_number, '');

    v_journal_id := public.create_journal_from_transaction(
      NULL, p_document_date, v_description, p_user_id, v_journal_type
    );
    IF p_currency <> 'DOP' THEN
      UPDATE journals SET currency = p_currency, exchange_rate = v_rate WHERE id = v_journal_id;
    END IF;

    IF v_is_payable THEN
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, p_offset_account_id, p_total_amount, 0, v_description),
        (v_journal_id, v_apar_account_id,   0, p_total_amount, 'A/P ' || p_contact_name);
    ELSE
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, v_apar_account_id,   p_total_amount, 0, 'A/R ' || p_contact_name),
        (v_journal_id, p_offset_account_id, 0, p_total_amount, v_description);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'document_id', v_doc_id,
    'journal_id',  v_journal_id
  );
END;
$function$;
