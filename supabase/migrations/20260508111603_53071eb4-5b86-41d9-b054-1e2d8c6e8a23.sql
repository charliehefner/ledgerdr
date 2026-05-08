
CREATE OR REPLACE FUNCTION public.autolink_apar_supplier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sid uuid;
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    SELECT s.name, COALESCE(NEW.contact_rnc, s.rnc::text)
      INTO NEW.contact_name, NEW.contact_rnc
    FROM suppliers s WHERE s.id = NEW.supplier_id;
    RETURN NEW;
  END IF;
  IF NEW.contact_rnc IS NOT NULL AND length(trim(NEW.contact_rnc)) > 0 THEN
    SELECT id INTO v_sid FROM suppliers
    WHERE rnc::text = trim(NEW.contact_rnc)
      AND (entity_id = NEW.entity_id OR entity_id IS NULL)
      AND is_active = true
    ORDER BY (entity_id = NEW.entity_id) DESC LIMIT 1;
  END IF;
  IF v_sid IS NULL AND NEW.contact_name IS NOT NULL THEN
    SELECT id INTO v_sid FROM suppliers
    WHERE lower(trim(name)) = lower(trim(NEW.contact_name))
      AND (entity_id = NEW.entity_id OR entity_id IS NULL)
      AND is_active = true
    ORDER BY (entity_id = NEW.entity_id) DESC LIMIT 1;
  END IF;
  IF v_sid IS NOT NULL THEN NEW.supplier_id := v_sid; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autolink_apar_supplier ON public.ap_ar_documents;
CREATE TRIGGER trg_autolink_apar_supplier
  BEFORE INSERT OR UPDATE OF contact_name, contact_rnc, supplier_id
  ON public.ap_ar_documents
  FOR EACH ROW EXECUTE FUNCTION public.autolink_apar_supplier();

UPDATE public.ap_ar_documents d SET supplier_id = s.id
FROM public.suppliers s
WHERE d.supplier_id IS NULL AND d.contact_rnc IS NOT NULL
  AND s.rnc::text = trim(d.contact_rnc)
  AND (s.entity_id = d.entity_id OR s.entity_id IS NULL) AND s.is_active = true;

UPDATE public.ap_ar_documents d SET supplier_id = s.id
FROM public.suppliers s
WHERE d.supplier_id IS NULL
  AND lower(trim(s.name)) = lower(trim(d.contact_name))
  AND (s.entity_id = d.entity_id OR s.entity_id IS NULL) AND s.is_active = true;

CREATE INDEX IF NOT EXISTS idx_apar_supplier ON public.ap_ar_documents(supplier_id);

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

  INSERT INTO ap_ar_documents (
    direction, document_type, contact_name, contact_rnc,
    document_number, document_date, due_date, currency,
    total_amount, amount_paid, status, notes,
    account_id, entity_id, supplier_id, contract_id,
    exchange_rate_used, total_amount_dop, created_by
  ) VALUES (
    p_direction, p_document_type,
    TRIM(v_name), NULLIF(TRIM(COALESCE(v_rnc,'')),''),
    NULLIF(TRIM(COALESCE(p_document_number,'')),''),
    p_document_date, p_due_date, p_currency,
    p_total_amount, 0, 'open', p_notes,
    v_apar_account_id, p_entity_id, p_supplier_id, p_contract_id,
    CASE WHEN p_currency <> 'DOP' THEN v_rate END,
    CASE WHEN p_currency <> 'DOP' THEN ROUND(p_total_amount * v_rate, 2) ELSE p_total_amount END,
    p_user_id
  ) RETURNING id INTO v_doc_id;

  IF p_post_journal AND p_offset_account_id IS NOT NULL THEN
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
  RETURN jsonb_build_object('document_id', v_doc_id, 'journal_id', v_journal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.aging_as_of(
  p_as_of date, p_direction text, p_entity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid, contact_name text, contact_rnc text, supplier_id uuid,
  document_number text, document_date date, due_date date, currency text,
  total_amount numeric, paid_as_of numeric, balance_as_of numeric,
  days_overdue integer, bucket text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH docs AS (
    SELECT d.* FROM ap_ar_documents d
    WHERE d.direction = p_direction AND d.document_date <= p_as_of
      AND d.status <> 'void'
      AND (p_entity_id IS NULL OR d.entity_id = p_entity_id)
      AND d.document_type IN ('invoice','bill','debit_note')
  ),
  pay AS (
    SELECT pa.document_id, COALESCE(SUM(pa.amount),0) AS paid_amt
    FROM ap_ar_payment_applications pa
    JOIN ap_ar_payments p ON p.id = pa.payment_id
    WHERE p.payment_date <= p_as_of
    GROUP BY pa.document_id
  ),
  pay_legacy AS (
    SELECT p.document_id, COALESCE(SUM(p.amount),0) AS paid_amt
    FROM ap_ar_payments p
    WHERE p.payment_date <= p_as_of
      AND NOT EXISTS (SELECT 1 FROM ap_ar_payment_applications pa WHERE pa.payment_id = p.id)
    GROUP BY p.document_id
  ),
  alloc AS (
    SELECT a.invoice_doc_id AS document_id, COALESCE(SUM(a.amount),0) AS paid_amt
    FROM advance_allocations a
    WHERE a.created_at::date <= p_as_of
    GROUP BY a.invoice_doc_id
  ),
  credit AS (
    SELECT c.target_doc_id AS document_id, COALESCE(SUM(c.amount),0) AS paid_amt
    FROM ap_ar_credit_applications c
    WHERE c.applied_at::date <= p_as_of
    GROUP BY c.target_doc_id
  ),
  totals AS (
    SELECT d.id,
      ROUND(COALESCE(p.paid_amt,0) + COALESCE(pl.paid_amt,0)
          + COALESCE(a.paid_amt,0) + COALESCE(c.paid_amt,0), 2) AS paid
    FROM docs d
    LEFT JOIN pay p ON p.document_id = d.id
    LEFT JOIN pay_legacy pl ON pl.document_id = d.id
    LEFT JOIN alloc a ON a.document_id = d.id
    LEFT JOIN credit c ON c.document_id = d.id
  )
  SELECT d.id, d.contact_name, d.contact_rnc, d.supplier_id,
    d.document_number, d.document_date, d.due_date, d.currency,
    d.total_amount, t.paid,
    ROUND(d.total_amount - t.paid, 2),
    GREATEST(0, (p_as_of - COALESCE(d.due_date, d.document_date)))::integer,
    CASE
      WHEN p_as_of <= COALESCE(d.due_date, d.document_date) THEN 'current'
      WHEN p_as_of - COALESCE(d.due_date, d.document_date) <= 30 THEN '1-30'
      WHEN p_as_of - COALESCE(d.due_date, d.document_date) <= 60 THEN '31-60'
      WHEN p_as_of - COALESCE(d.due_date, d.document_date) <= 90 THEN '61-90'
      ELSE '90+' END
  FROM docs d JOIN totals t ON t.id = d.id
  WHERE ROUND(d.total_amount - t.paid, 2) > 0.005
  ORDER BY d.document_date;
$$;

GRANT EXECUTE ON FUNCTION public.aging_as_of(date, text, uuid) TO authenticated;
