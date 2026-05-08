
-- ============================================================
-- 1. Recompute helper: derives amount_paid + status from
--    ap_ar_payments + advance_allocations.
--    balance_remaining is a GENERATED column so it auto-updates.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_ap_ar_document_balance(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total          numeric;
  v_current_status text;
  v_payments       numeric;
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

  -- Voided docs: do not auto-recompute (status preserved by void workflow)
  IF v_current_status = 'void' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_payments
  FROM ap_ar_payments
  WHERE document_id = p_document_id;

  -- Allocations where this doc is the invoice being settled by an advance
  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_invoice
  FROM advance_allocations
  WHERE invoice_doc_id = p_document_id;

  -- Allocations where this doc is the advance being consumed by an invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_advance
  FROM advance_allocations
  WHERE advance_doc_id = p_document_id;

  v_paid := ROUND(v_payments + v_alloc_invoice + v_alloc_advance, 2);

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
$$;

-- ============================================================
-- 2. Trigger on ap_ar_payments → recompute affected document(s)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_recompute_ap_ar_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_ap_ar_document_balance(OLD.document_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_ap_ar_document_balance(NEW.document_id);
    IF NEW.document_id IS DISTINCT FROM OLD.document_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.document_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recompute_ap_ar_document_balance(NEW.document_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recompute_ap_ar_balance_on_payment ON public.ap_ar_payments;
CREATE TRIGGER recompute_ap_ar_balance_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.ap_ar_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_ap_ar_from_payment();

-- ============================================================
-- 3. Replace advance_allocations sync with the unified helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_advance_allocation_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_ap_ar_document_balance(OLD.advance_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(OLD.invoice_doc_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_ap_ar_document_balance(NEW.advance_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(NEW.invoice_doc_id);
    IF NEW.advance_doc_id IS DISTINCT FROM OLD.advance_doc_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.advance_doc_id);
    END IF;
    IF NEW.invoice_doc_id IS DISTINCT FROM OLD.invoice_doc_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.invoice_doc_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recompute_ap_ar_document_balance(NEW.advance_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(NEW.invoice_doc_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Ensure the trigger fires for all DML (was originally INSERT-only)
DROP TRIGGER IF EXISTS sync_advance_allocation_balances_trigger ON public.advance_allocations;
DROP TRIGGER IF EXISTS sync_advance_allocation_balances ON public.advance_allocations;
CREATE TRIGGER sync_advance_allocation_balances
AFTER INSERT OR UPDATE OR DELETE ON public.advance_allocations
FOR EACH ROW EXECUTE FUNCTION public.sync_advance_allocation_balances();

-- ============================================================
-- 4. Atomic apply_ap_ar_payment RPC
--    Replaces 5-step client-side orchestration in PaymentDialog.
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
  v_journal_type        text;
  v_is_payable          boolean;
  v_tx_id               uuid;
  v_tx_legacy           bigint;
  v_payment_id          uuid;
  v_description         text;
  v_currency_pair       text;
  v_rate                numeric;
BEGIN
  IF p_document_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_bank_account_id IS NULL OR p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos para apply_ap_ar_payment';
  END IF;

  -- Lock the document row
  SELECT * INTO v_doc FROM ap_ar_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento A/P-A/R no encontrado';
  END IF;

  IF v_doc.status IN ('paid','void') THEN
    RAISE EXCEPTION 'No se puede registrar pago: documento %', v_doc.status;
  END IF;

  IF p_amount > v_doc.balance_remaining + 0.005 THEN
    RAISE EXCEPTION 'El monto excede el saldo pendiente';
  END IF;

  v_is_payable   := (v_doc.direction = 'payable');
  v_journal_type := CASE WHEN v_is_payable THEN 'CDJ' ELSE 'CRJ' END;

  -- Resolve bank account → linked GL account
  SELECT chart_account_id, account_name
    INTO v_bank_chart_account, v_bank_name
  FROM bank_accounts
  WHERE id = p_bank_account_id;

  IF v_bank_chart_account IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria sin cuenta contable enlazada';
  END IF;

  -- Resolve A/P or A/R control account
  v_ap_ar_account_id := v_doc.account_id;
  IF v_ap_ar_account_id IS NULL THEN
    SELECT id, account_code
      INTO v_ap_ar_account_id, v_ap_ar_account_code
    FROM chart_of_accounts
    WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
      AND allow_posting = true
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_ap_ar_account_id IS NULL THEN
      RAISE EXCEPTION 'Cuenta contable A/P-A/R no encontrada (% )',
        CASE WHEN v_is_payable THEN '2101' ELSE '1210' END;
    END IF;
  ELSE
    SELECT account_code INTO v_ap_ar_account_code
    FROM chart_of_accounts WHERE id = v_ap_ar_account_id;
  END IF;

  v_description := CASE WHEN v_is_payable THEN 'Pago a ' ELSE 'Cobro de ' END
                || v_doc.contact_name
                || ' — '
                || COALESCE(v_doc.document_number, 'sin número');

  -- Resolve FX rate if non-DOP (USD or EUR)
  IF v_doc.currency <> 'DOP' THEN
    IF p_exchange_rate IS NOT NULL AND p_exchange_rate > 0 THEN
      v_rate := p_exchange_rate;
    ELSE
      v_currency_pair := v_doc.currency || '/DOP';
      SELECT sell_rate INTO v_rate
      FROM exchange_rates
      WHERE currency_pair = v_currency_pair
      ORDER BY rate_date DESC
      LIMIT 1;
      IF v_rate IS NULL THEN
        v_currency_pair := v_doc.currency || '_DOP';
        SELECT sell_rate INTO v_rate
        FROM exchange_rates
        WHERE currency_pair = v_currency_pair
        ORDER BY rate_date DESC
        LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1);
    END IF;
  ELSE
    v_rate := 1;
  END IF;

  -- 1) Create journal
  v_journal_id := public.create_journal_from_transaction(
    NULL, p_payment_date, v_description, p_user_id, v_journal_type
  );

  -- 2) Currency on journal
  IF v_doc.currency <> 'DOP' THEN
    UPDATE journals
    SET currency = v_doc.currency, exchange_rate = v_rate
    WHERE id = v_journal_id;
  END IF;

  -- 3) Journal lines (Dr/Cr)
  IF v_is_payable THEN
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (v_journal_id, v_ap_ar_account_id, p_amount, 0, 'Pago a ' || v_doc.contact_name),
      (v_journal_id, v_bank_chart_account, 0, p_amount, 'Pago desde ' || v_bank_name);
  ELSE
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
      (v_journal_id, v_bank_chart_account, p_amount, 0, 'Cobro de ' || v_doc.contact_name),
      (v_journal_id, v_ap_ar_account_id, 0, p_amount, 'Cobro de ' || v_doc.contact_name);
  END IF;

  -- 4) Insert mirror transaction
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

  -- 5) Link journal to transaction
  UPDATE journals SET transaction_source_id = v_tx_id WHERE id = v_journal_id;

  -- 6) Insert payment row (trigger will recompute amount_paid + status)
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
    'transaction_id', v_tx_id,
    'transaction_legacy_id', v_tx_legacy
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_ap_ar_payment(uuid,date,numeric,uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_ap_ar_document_balance(uuid) TO authenticated;

-- ============================================================
-- 5. Backfill: recompute every non-void document
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM ap_ar_documents WHERE status <> 'void' LOOP
    PERFORM public.recompute_ap_ar_document_balance(r.id);
  END LOOP;
END $$;
