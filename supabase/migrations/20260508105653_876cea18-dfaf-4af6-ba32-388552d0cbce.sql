
-- ============================================================
-- Helper: post a reversing journal for an existing journal.
-- Returns the new journal id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_reversing_journal(
  p_source_journal_id uuid,
  p_reversal_date     date,
  p_user_id           uuid DEFAULT NULL,
  p_reason            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src      journals%ROWTYPE;
  v_new_id   uuid;
BEGIN
  SELECT * INTO v_src FROM journals WHERE id = p_source_journal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asiento original % no encontrado', p_source_journal_id;
  END IF;

  INSERT INTO journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, journal_type,
    reversal_of_id, created_by
  ) VALUES (
    p_reversal_date,
    'REVERSO: ' || COALESCE(v_src.description,'') || COALESCE(' — ' || p_reason, ''),
    v_src.currency, v_src.exchange_rate,
    true, now(), p_user_id, COALESCE(v_src.journal_type,'GJ'),
    v_src.id, p_user_id
  )
  RETURNING id INTO v_new_id;

  -- Mirror lines with debit/credit swapped
  INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
  SELECT v_new_id, account_id, credit, debit,
         COALESCE('REVERSO: ' || description, 'REVERSO')
  FROM journal_lines
  WHERE journal_id = v_src.id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_reversing_journal(uuid,date,uuid,text) TO authenticated;

-- ============================================================
-- Replace apply_ap_ar_payment with FX-aware version (P0 #4).
-- Posts a small DOP-only adjustment to 8510 when the payment
-- rate differs from the document's booking rate, so the
-- control account's local-currency balance fully clears.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_ap_ar_payment(
  p_document_id     uuid,
  p_payment_date    date,
  p_amount          numeric,
  p_bank_account_id uuid,
  p_user_id         uuid DEFAULT NULL,
  p_exchange_rate   numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc                 ap_ar_documents%ROWTYPE;
  v_bank_chart_account  uuid;
  v_bank_name           text;
  v_ap_ar_account_id    uuid;
  v_ap_ar_account_code  text;
  v_journal_id          uuid;
  v_fx_journal_id       uuid;
  v_fx_account_id       uuid;
  v_journal_type        text;
  v_is_payable          boolean;
  v_tx_id               uuid;
  v_tx_legacy           bigint;
  v_payment_id          uuid;
  v_description         text;
  v_currency_pair       text;
  v_rate                numeric;
  v_doc_rate            numeric;
  v_fx_diff_dop         numeric;
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
    IF v_ap_ar_account_id IS NULL THEN
      RAISE EXCEPTION 'Cuenta contable A/P-A/R no encontrada';
    END IF;
  ELSE
    SELECT account_code INTO v_ap_ar_account_code
    FROM chart_of_accounts WHERE id = v_ap_ar_account_id;
  END IF;

  v_description := CASE WHEN v_is_payable THEN 'Pago a ' ELSE 'Cobro de ' END
                || v_doc.contact_name || ' — '
                || COALESCE(v_doc.document_number, 'sin número');

  -- Resolve payment FX rate
  IF v_doc.currency <> 'DOP' THEN
    IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
      v_rate := p_exchange_rate;
    ELSE
      v_currency_pair := v_doc.currency || '/DOP';
      SELECT sell_rate INTO v_rate FROM exchange_rates
        WHERE currency_pair = v_currency_pair
        ORDER BY rate_date DESC LIMIT 1;
      IF v_rate IS NULL THEN
        v_currency_pair := v_doc.currency || '_DOP';
        SELECT sell_rate INTO v_rate FROM exchange_rates
          WHERE currency_pair = v_currency_pair
          ORDER BY rate_date DESC LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1);
    END IF;
  ELSE
    v_rate := 1;
  END IF;

  -- 1) Main journal
  v_journal_id := public.create_journal_from_transaction(
    NULL, p_payment_date, v_description, p_user_id, v_journal_type
  );
  IF v_doc.currency <> 'DOP' THEN
    UPDATE journals SET currency = v_doc.currency, exchange_rate = v_rate
    WHERE id = v_journal_id;
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

  -- 2) Realized FX gain/loss adjustment (P0 #4)
  IF v_doc.currency <> 'DOP'
     AND v_doc.exchange_rate_used IS NOT NULL
     AND v_doc.exchange_rate_used > 0 THEN
    v_doc_rate    := v_doc.exchange_rate_used;
    v_fx_diff_dop := ROUND(p_amount * (v_rate - v_doc_rate), 2);

    IF abs(v_fx_diff_dop) >= 0.01 THEN
      SELECT id INTO v_fx_account_id
      FROM chart_of_accounts
      WHERE account_code = '8510' AND allow_posting = true AND deleted_at IS NULL
      LIMIT 1;
      IF v_fx_account_id IS NULL THEN
        RAISE EXCEPTION 'Cuenta 8510 (Diferencia Cambiaria) no encontrada';
      END IF;

      INSERT INTO journals (
        journal_date, description, currency, exchange_rate,
        posted, posted_at, posted_by, journal_type, created_by
      ) VALUES (
        p_payment_date,
        'FX realizado — ' || v_description
          || ' (rate doc ' || v_doc_rate::text || ' → pago ' || v_rate::text || ')',
        'DOP', 1, true, now(), p_user_id, 'GJ', p_user_id
      )
      RETURNING id INTO v_fx_journal_id;

      -- Sign convention: clear residual on AP/AR control vs 8510.
      -- Payable: rate↑ → we paid more DOP → AP residual is a credit balance
      --          to clear → Debit AP, Credit 8510 (loss).
      -- Receivable: rate↑ → we collected more DOP → AR residual is a debit
      --          balance to clear → Credit AR, Debit 8510 (gain on income side).
      IF (v_is_payable AND v_fx_diff_dop > 0)
         OR (NOT v_is_payable AND v_fx_diff_dop < 0) THEN
        -- Loss
        INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
          (v_fx_journal_id, v_ap_ar_account_id, abs(v_fx_diff_dop), 0,
           'Ajuste FX cuenta de control'),
          (v_fx_journal_id, v_fx_account_id, 0, abs(v_fx_diff_dop),
           'Pérdida cambiaria realizada');
      ELSE
        -- Gain (or AR with rate↓ etc.)
        INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
          (v_fx_journal_id, v_fx_account_id, abs(v_fx_diff_dop), 0,
           'Ganancia cambiaria realizada'),
          (v_fx_journal_id, v_ap_ar_account_id, 0, abs(v_fx_diff_dop),
           'Ajuste FX cuenta de control');
      END IF;
    END IF;
  END IF;

  -- 3) Mirror transaction
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

  -- 4) Payment row
  INSERT INTO ap_ar_payments (
    document_id, payment_date, amount, payment_method,
    bank_account_id, journal_id, created_by, notes
  ) VALUES (
    p_document_id, p_payment_date, p_amount, v_bank_name,
    p_bank_account_id, v_journal_id, p_user_id,
    'TX-' || v_tx_legacy::text
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'payment_id',     v_payment_id,
    'journal_id',     v_journal_id,
    'fx_journal_id',  v_fx_journal_id,
    'fx_diff_dop',    COALESCE(v_fx_diff_dop, 0),
    'transaction_id', v_tx_id,
    'transaction_legacy_id', v_tx_legacy
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_ap_ar_payment(uuid,date,numeric,uuid,uuid,numeric) TO authenticated;

-- ============================================================
-- void_ap_ar_document (P0 #5) — atomic void with reversing journals
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_ap_ar_document(
  p_document_id uuid,
  p_user_id     uuid DEFAULT NULL,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc              ap_ar_documents%ROWTYPE;
  v_pay              RECORD;
  v_orig_journal_id  uuid;
  v_reversed         int := 0;
  v_void_date        date := CURRENT_DATE;
BEGIN
  SELECT * INTO v_doc FROM ap_ar_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento no encontrado'; END IF;
  IF v_doc.status = 'void' THEN RAISE EXCEPTION 'El documento ya está anulado'; END IF;

  -- 1) Reverse every payment journal and delete the payment row.
  --    Trigger recomputes balance, but final UPDATE below sets status='void'
  --    (recompute helper is a no-op for void docs).
  FOR v_pay IN
    SELECT id, journal_id FROM ap_ar_payments
    WHERE document_id = p_document_id
    FOR UPDATE
  LOOP
    IF v_pay.journal_id IS NOT NULL THEN
      PERFORM public.post_reversing_journal(
        v_pay.journal_id, v_void_date, p_user_id,
        'Anulación documento ' || COALESCE(v_doc.document_number, v_doc.id::text)
      );
      v_reversed := v_reversed + 1;
    END IF;
    DELETE FROM ap_ar_payments WHERE id = v_pay.id;
  END LOOP;

  -- 2) Reverse the original document journal(s), located via the
  --    transactions linked to this document.
  FOR v_orig_journal_id IN
    SELECT DISTINCT j.id
    FROM ap_ar_document_transactions adt
    JOIN journals j ON j.transaction_source_id = adt.transaction_id
    WHERE adt.document_id = p_document_id
      AND j.deleted_at IS NULL
      AND j.reversal_of_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journals r WHERE r.reversal_of_id = j.id
      )
  LOOP
    PERFORM public.post_reversing_journal(
      v_orig_journal_id, v_void_date, p_user_id,
      'Anulación documento ' || COALESCE(v_doc.document_number, v_doc.id::text)
    );
    v_reversed := v_reversed + 1;
  END LOOP;

  -- 3) Mark document void (recompute helper skips void docs)
  UPDATE ap_ar_documents
  SET status      = 'void',
      amount_paid = 0,
      notes       = COALESCE(notes || E'\n', '')
                 || '[VOID ' || v_void_date::text || ']'
                 || COALESCE(' ' || p_reason, ''),
      updated_at  = now()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'reversed_journals', v_reversed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_ap_ar_document(uuid,uuid,text) TO authenticated;
