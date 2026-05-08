
-- 1. Add journal_id column for drilldown
ALTER TABLE public.advance_allocations
  ADD COLUMN IF NOT EXISTS journal_id UUID REFERENCES public.journals(id);

-- 2. Trigger function: post journal Dr <invoice AP/AR account> / Cr <advance account>
CREATE OR REPLACE FUNCTION public.post_advance_allocation_journal()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_advance        RECORD;
  v_invoice        RECORD;
  v_inv_account_id UUID;
  v_adv_account_id UUID;
  v_journal_id     UUID;
  v_period_id      UUID;
  v_journal_no     TEXT;
BEGIN
  -- Pull both documents
  SELECT id, account_id, contact_name, currency, entity_id, document_number, direction
  INTO v_advance
  FROM ap_ar_documents WHERE id = NEW.advance_doc_id;

  SELECT id, account_id, contact_name, currency, entity_id, document_number, direction, document_date
  INTO v_invoice
  FROM ap_ar_documents WHERE id = NEW.invoice_doc_id;

  v_inv_account_id := v_invoice.account_id;
  v_adv_account_id := v_advance.account_id;

  IF v_inv_account_id IS NULL OR v_adv_account_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta GL no definida en uno de los documentos (advance=%, invoice=%)',
      v_adv_account_id, v_inv_account_id;
  END IF;

  -- Find an open period covering today; fall back to invoice date period
  SELECT id INTO v_period_id
  FROM accounting_periods
  WHERE status = 'open'
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1;

  IF v_period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM accounting_periods
    WHERE status = 'open'
      AND v_invoice.document_date BETWEEN start_date AND end_date
    LIMIT 1;
  END IF;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No hay período contable abierto para registrar el asiento de aplicación de anticipo';
  END IF;

  -- Generate journal number
  v_journal_no := 'AAL-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6);

  -- Create journal header
  INSERT INTO journals (
    journal_number, journal_date, period_id, status, source_type,
    description, created_by, entity_id, currency
  ) VALUES (
    v_journal_no, CURRENT_DATE, v_period_id, 'posted', 'advance_allocation',
    format('Aplicación de anticipo a %s — %s',
      COALESCE(v_invoice.document_number, '(s/n)'),
      v_advance.contact_name),
    NEW.allocated_by,
    COALESCE(v_invoice.entity_id, v_advance.entity_id),
    COALESCE(v_invoice.currency, 'DOP')
  )
  RETURNING id INTO v_journal_id;

  -- Lines: depending on direction, debit/credit flip
  IF v_invoice.direction = 'payable' THEN
    -- Dr AP (clear payable), Cr 1690 (consume advance)
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
    VALUES
      (v_journal_id, v_inv_account_id, NEW.amount, 0, NEW.allocated_by,
        'Aplicación anticipo a CxP'),
      (v_journal_id, v_adv_account_id, 0, NEW.amount, NEW.allocated_by,
        'Aplicación anticipo a CxP');
  ELSE
    -- Receivable: Cr AR, Dr 1690-equivalent (rare for AR, but kept symmetric)
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
    VALUES
      (v_journal_id, v_adv_account_id, NEW.amount, 0, NEW.allocated_by,
        'Aplicación anticipo a CxC'),
      (v_journal_id, v_inv_account_id, 0, NEW.amount, NEW.allocated_by,
        'Aplicación anticipo a CxC');
  END IF;

  -- Save journal id back onto the allocation
  UPDATE advance_allocations SET journal_id = v_journal_id WHERE id = NEW.id;

  -- Polymorphic source links (drilldown audit chain)
  INSERT INTO journal_source_links (journal_id, source_table, source_id)
  VALUES
    (v_journal_id, 'advance_allocations', NEW.id),
    (v_journal_id, 'ap_ar_documents', NEW.advance_doc_id),
    (v_journal_id, 'ap_ar_documents', NEW.invoice_doc_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_advance_allocation_journal ON public.advance_allocations;
CREATE TRIGGER trg_post_advance_allocation_journal
  AFTER INSERT ON public.advance_allocations
  FOR EACH ROW EXECUTE FUNCTION public.post_advance_allocation_journal();
