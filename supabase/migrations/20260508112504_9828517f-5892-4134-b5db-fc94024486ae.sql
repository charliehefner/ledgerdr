
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.suppliers.credit_limit IS
  'Customer credit limit in DOP. 0 = unlimited. Enforced on receivable AP/AR creation.';

-- Helper: outstanding receivable balance (DOP) for a supplier/customer
CREATE OR REPLACE FUNCTION public.customer_outstanding_dop(p_supplier_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE WHEN currency = 'DOP'
         THEN balance_remaining
         ELSE balance_remaining * COALESCE(exchange_rate_used, 1) END
  ), 0)
  FROM public.ap_ar_documents
  WHERE supplier_id = p_supplier_id
    AND direction = 'receivable'
    AND status NOT IN ('paid','void');
$$;

GRANT EXECUTE ON FUNCTION public.customer_outstanding_dop(uuid) TO authenticated;

-- Patch create_ap_ar_document to enforce credit limit on receivables
CREATE OR REPLACE FUNCTION public.create_ap_ar_document(
  p_direction text, p_document_type text, p_contact_name text,
  p_contact_rnc text DEFAULT NULL, p_document_number text DEFAULT NULL,
  p_document_date date DEFAULT CURRENT_DATE, p_due_date date DEFAULT NULL,
  p_currency text DEFAULT 'DOP', p_total_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL, p_account_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL, p_contract_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL, p_offset_account_id uuid DEFAULT NULL,
  p_post_journal boolean DEFAULT false, p_exchange_rate numeric DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc_id uuid; v_journal_id uuid; v_apar_account_id uuid;
  v_is_payable boolean; v_journal_type text; v_description text;
  v_rate numeric := COALESCE(p_exchange_rate, 1);
  v_name text := p_contact_name; v_rnc text := p_contact_rnc;
  v_amount_dop numeric;
  v_submitter_role app_role;
  v_policy RECORD;
  v_needs_approval boolean := false;
  v_approval_id uuid;
  v_will_post_journal boolean;
  v_credit_limit numeric;
  v_outstanding numeric;
BEGIN
  IF p_direction NOT IN ('payable','receivable') THEN
    RAISE EXCEPTION 'direction debe ser payable o receivable'; END IF;
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'total_amount debe ser positivo'; END IF;

  IF p_supplier_id IS NOT NULL THEN
    SELECT s.name, COALESCE(NULLIF(trim(p_contact_rnc::text),''), s.rnc::text)
      INTO v_name, v_rnc
    FROM suppliers s WHERE s.id = p_supplier_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'supplier_id % no encontrado', p_supplier_id; END IF;
  END IF;
  IF COALESCE(TRIM(v_name),'') = '' THEN
    RAISE EXCEPTION 'contact_name o supplier_id es requerido'; END IF;

  v_is_payable := (p_direction = 'payable');
  v_apar_account_id := p_account_id;
  IF v_apar_account_id IS NULL THEN
    SELECT id INTO v_apar_account_id FROM chart_of_accounts
    WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
      AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
  END IF;

  v_amount_dop := CASE WHEN p_currency <> 'DOP' THEN ROUND(p_total_amount * v_rate, 2) ELSE p_total_amount END;

  -- Credit limit enforcement (receivables only, requires supplier_id)
  IF NOT v_is_payable AND p_supplier_id IS NOT NULL THEN
    SELECT credit_limit INTO v_credit_limit FROM suppliers WHERE id = p_supplier_id;
    IF COALESCE(v_credit_limit, 0) > 0 THEN
      v_outstanding := public.customer_outstanding_dop(p_supplier_id);
      IF (v_outstanding + v_amount_dop) > v_credit_limit THEN
        RAISE EXCEPTION 'Límite de crédito excedido para %: saldo %, límite %, nuevo cargo %',
          v_name, v_outstanding, v_credit_limit, v_amount_dop;
      END IF;
    END IF;
  END IF;

  -- Approval policy
  IF p_user_id IS NOT NULL THEN
    v_submitter_role := public.user_top_role(p_user_id);
    SELECT * INTO v_policy FROM approval_policies
    WHERE applies_to = 'ap_ar_document' AND is_active = true
      AND (entity_id = p_entity_id OR entity_id IS NULL)
      AND (role_submitter IS NULL OR role_submitter = v_submitter_role)
      AND v_amount_dop >= amount_threshold
    ORDER BY amount_threshold DESC, (entity_id = p_entity_id) DESC LIMIT 1;
    IF FOUND AND NOT public.has_role(p_user_id, v_policy.approver_role) THEN
      v_needs_approval := true;
    END IF;
  END IF;

  v_will_post_journal := p_post_journal AND p_offset_account_id IS NOT NULL AND NOT v_needs_approval;

  INSERT INTO ap_ar_documents (
    direction, document_type, contact_name, contact_rnc,
    document_number, document_date, due_date, currency,
    total_amount, amount_paid, status, notes,
    account_id, entity_id, supplier_id, contract_id,
    exchange_rate_used, total_amount_dop, created_by, approval_status
  ) VALUES (
    p_direction, p_document_type,
    TRIM(v_name), NULLIF(TRIM(COALESCE(v_rnc,'')),''),
    NULLIF(TRIM(COALESCE(p_document_number,'')),''),
    p_document_date, p_due_date, p_currency,
    p_total_amount, 0, 'open', p_notes,
    v_apar_account_id, p_entity_id, p_supplier_id, p_contract_id,
    CASE WHEN p_currency <> 'DOP' THEN v_rate END,
    v_amount_dop, p_user_id,
    CASE WHEN v_needs_approval THEN 'pending' ELSE 'not_required' END
  ) RETURNING id INTO v_doc_id;

  IF v_needs_approval THEN
    INSERT INTO approval_requests (
      applies_to, record_id, amount, currency, description,
      submitted_by, status, entity_id
    ) VALUES (
      'ap_ar_document', v_doc_id, v_amount_dop, 'DOP',
      (CASE WHEN v_is_payable THEN 'Factura A/P de ' ELSE 'Factura A/R a ' END)
        || v_name || COALESCE(' — ' || p_document_number, ''),
      p_user_id, 'pending', p_entity_id
    ) RETURNING id INTO v_approval_id;
    UPDATE ap_ar_documents SET approval_request_id = v_approval_id WHERE id = v_doc_id;
  END IF;

  IF v_will_post_journal THEN
    v_journal_type := CASE WHEN v_is_payable THEN 'PJ' ELSE 'SJ' END;
    v_description  := CASE WHEN v_is_payable THEN 'Factura de ' ELSE 'Factura a ' END
                      || v_name || COALESCE(' — ' || p_document_number, '');
    v_journal_id := public.create_journal_from_transaction(NULL, p_document_date, v_description, p_user_id, v_journal_type);
    IF p_currency <> 'DOP' THEN
      UPDATE journals SET currency = p_currency, exchange_rate = v_rate WHERE id = v_journal_id;
    END IF;
    IF v_is_payable THEN
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, p_offset_account_id, p_total_amount, 0, v_description),
        (v_journal_id, v_apar_account_id,   0, p_total_amount, 'A/P ' || v_name);
    ELSE
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, v_apar_account_id,   p_total_amount, 0, 'A/R ' || v_name),
        (v_journal_id, p_offset_account_id, 0, p_total_amount, v_description);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'document_id', v_doc_id, 'journal_id', v_journal_id,
    'approval_status', CASE WHEN v_needs_approval THEN 'pending' ELSE 'not_required' END,
    'approval_request_id', v_approval_id
  );
END;
$$;
