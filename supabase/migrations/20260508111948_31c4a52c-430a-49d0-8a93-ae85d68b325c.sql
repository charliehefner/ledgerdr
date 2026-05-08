
-- ============================================================
-- #9: Approval gate for manual AP/AR documents
-- ============================================================

ALTER TABLE public.ap_ar_documents
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approval_request_id uuid;

CREATE INDEX IF NOT EXISTS idx_apar_approval_status ON public.ap_ar_documents(approval_status);

-- Helper: get the highest ranked role for a user (admin > management > accountant > supervisor > office > driver > viewer)
CREATE OR REPLACE FUNCTION public.user_top_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1 WHEN 'management' THEN 2 WHEN 'accountant' THEN 3
    WHEN 'supervisor' THEN 4 WHEN 'office' THEN 5 WHEN 'driver' THEN 6
    WHEN 'viewer' THEN 7 END
  LIMIT 1;
$$;

-- Update create_ap_ar_document to evaluate approval policies
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

  -- Evaluate approval policy (DOP-equivalent)
  IF p_user_id IS NOT NULL THEN
    v_submitter_role := public.user_top_role(p_user_id);
    SELECT * INTO v_policy FROM approval_policies
    WHERE applies_to = 'ap_ar_document'
      AND is_active = true
      AND (entity_id = p_entity_id OR entity_id IS NULL)
      AND (role_submitter IS NULL OR role_submitter = v_submitter_role)
      AND v_amount_dop >= amount_threshold
    ORDER BY amount_threshold DESC, (entity_id = p_entity_id) DESC
    LIMIT 1;
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
    IF v_apar_account_id IS NULL THEN RAISE EXCEPTION 'Cuenta A/P-A/R no resuelta'; END IF;
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
    'document_id', v_doc_id,
    'journal_id', v_journal_id,
    'approval_status', CASE WHEN v_needs_approval THEN 'pending' ELSE 'not_required' END,
    'approval_request_id', v_approval_id
  );
END;
$$;

-- RPC: approve / reject an AP/AR document approval and optionally post the journal now
CREATE OR REPLACE FUNCTION public.review_ap_ar_approval(
  p_request_id uuid,
  p_decision text,                    -- 'approved' | 'rejected'
  p_reviewer_id uuid,
  p_offset_account_id uuid DEFAULT NULL,
  p_review_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req RECORD; v_doc RECORD; v_journal_id uuid;
  v_journal_type text; v_description text;
BEGIN
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'decision inválida'; END IF;

  SELECT * INTO v_req FROM approval_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Solicitud ya % ', v_req.status; END IF;
  IF v_req.applies_to <> 'ap_ar_document' THEN RAISE EXCEPTION 'Tipo incorrecto'; END IF;

  UPDATE approval_requests SET
    status = p_decision, reviewed_by = p_reviewer_id,
    reviewed_at = now(), review_note = p_review_note
  WHERE id = p_request_id;

  IF p_decision = 'rejected' THEN
    UPDATE ap_ar_documents SET approval_status = 'rejected', status = 'void'
    WHERE id = v_req.record_id;
    RETURN jsonb_build_object('approved', false);
  END IF;

  -- Approved
  SELECT * INTO v_doc FROM ap_ar_documents WHERE id = v_req.record_id;
  UPDATE ap_ar_documents SET approval_status = 'approved' WHERE id = v_doc.id;

  -- Post journal now if offset account supplied
  IF p_offset_account_id IS NOT NULL AND v_doc.account_id IS NOT NULL THEN
    v_journal_type := CASE WHEN v_doc.direction='payable' THEN 'PJ' ELSE 'SJ' END;
    v_description := CASE WHEN v_doc.direction='payable' THEN 'Factura de ' ELSE 'Factura a ' END
                     || v_doc.contact_name || COALESCE(' — ' || v_doc.document_number, '');
    v_journal_id := public.create_journal_from_transaction(NULL, v_doc.document_date, v_description, p_reviewer_id, v_journal_type);
    IF v_doc.currency <> 'DOP' THEN
      UPDATE journals SET currency = v_doc.currency, exchange_rate = COALESCE(v_doc.exchange_rate_used, 1)
      WHERE id = v_journal_id;
    END IF;
    IF v_doc.direction = 'payable' THEN
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, p_offset_account_id, v_doc.total_amount, 0, v_description),
        (v_journal_id, v_doc.account_id,    0, v_doc.total_amount, 'A/P ' || v_doc.contact_name);
    ELSE
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, v_doc.account_id,    v_doc.total_amount, 0, 'A/R ' || v_doc.contact_name),
        (v_journal_id, p_offset_account_id, 0, v_doc.total_amount, v_description);
    END IF;
  END IF;

  RETURN jsonb_build_object('approved', true, 'journal_id', v_journal_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_ap_ar_approval(uuid, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_top_role(uuid) TO authenticated;

-- ============================================================
-- #12: DB-level edit lock on posted/paid/void documents
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_apar_edit_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_locked boolean;
BEGIN
  v_locked := (OLD.status IN ('paid','void')
               OR COALESCE(OLD.amount_paid, 0) > 0
               OR OLD.approval_status = 'approved');

  IF NOT v_locked THEN RETURN NEW; END IF;

  -- Allow only safe field changes once locked: notes, due_date, status updates by triggers,
  -- balance_remaining/amount_paid (maintained by triggers), updated_at, approval_status
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.document_date IS DISTINCT FROM OLD.document_date
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.exchange_rate_used IS DISTINCT FROM OLD.exchange_rate_used
     OR NEW.total_amount_dop IS DISTINCT FROM OLD.total_amount_dop
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.contact_rnc IS DISTINCT FROM OLD.contact_rnc
     OR NEW.contact_name IS DISTINCT FROM OLD.contact_name
     OR NEW.document_number IS DISTINCT FROM OLD.document_number
  THEN
    RAISE EXCEPTION 'Documento bloqueado: % (campos financieros no editables después de pago/aprobación/anulación)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_apar_edit_lock ON public.ap_ar_documents;
CREATE TRIGGER trg_enforce_apar_edit_lock
  BEFORE UPDATE ON public.ap_ar_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_apar_edit_lock();

-- Block deletes when payments exist or doc not in 'open' state with zero paid
CREATE OR REPLACE FUNCTION public.enforce_apar_delete_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ap_ar_payments WHERE document_id = OLD.id)
     OR EXISTS (SELECT 1 FROM ap_ar_payment_applications WHERE document_id = OLD.id)
     OR EXISTS (SELECT 1 FROM advance_allocations WHERE invoice_doc_id = OLD.id OR advance_doc_id = OLD.id)
     OR EXISTS (SELECT 1 FROM ap_ar_credit_applications WHERE target_doc_id = OLD.id OR credit_doc_id = OLD.id)
     OR OLD.status IN ('paid','partial','void')
     OR COALESCE(OLD.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Documento no se puede eliminar: tiene pagos/aplicaciones o no está abierto. Use anular (void).';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_apar_delete_lock ON public.ap_ar_documents;
CREATE TRIGGER trg_enforce_apar_delete_lock
  BEFORE DELETE ON public.ap_ar_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_apar_delete_lock();
