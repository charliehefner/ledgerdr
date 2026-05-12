CREATE OR REPLACE FUNCTION public.apply_ap_ar_payment(p_document_id uuid, p_payment_date date, p_amount numeric, p_bank_account_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_exchange_rate numeric DEFAULT NULL::numeric)
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
  UPDATE journals SET entity_id = COALESCE(entity_id, v_doc.entity_id) WHERE id = v_journal_id;
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

  IF v_doc.currency <> 'DOP' AND v_doc.exchange_rate_used IS NOT NULL AND v_doc.exchange_rate_used > 0 THEN
    v_doc_rate    := v_doc.exchange_rate_used;
    v_fx_diff_dop := ROUND(p_amount * (v_rate - v_doc_rate), 2);
    IF abs(v_fx_diff_dop) >= 0.01 THEN
      SELECT id INTO v_fx_account_id FROM chart_of_accounts
      WHERE account_code = '8510' AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
      IF v_fx_account_id IS NULL THEN RAISE EXCEPTION 'Cuenta 8510 (Diferencia Cambiaria) no encontrada'; END IF;

      INSERT INTO journals (journal_date, description, currency, exchange_rate,
        posted, posted_at, posted_by, journal_type, created_by, entity_id)
      VALUES (p_payment_date,
        'FX realizado — ' || v_description
          || ' (rate doc ' || v_doc_rate::text || ' → pago ' || v_rate::text || ')',
        'DOP', 1, true, now(), p_user_id, 'GJ', p_user_id, v_doc.entity_id)
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
    transaction_direction, is_internal, cost_center, exchange_rate,
    entity_id
  ) VALUES (
    p_payment_date, v_description, p_amount, v_doc.currency,
    p_bank_account_id::text, v_doc.contact_name,
    COALESCE(v_ap_ar_account_code, CASE WHEN v_is_payable THEN '2101' ELSE '1210' END),
    CASE WHEN v_is_payable THEN 'purchase' ELSE 'sale' END,
    false, 'general', v_rate,
    v_doc.entity_id
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