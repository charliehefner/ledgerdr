CREATE OR REPLACE FUNCTION public.register_service_partial_payment(p_service_entry_id uuid, p_payment_date date, p_amount numeric, p_bank_account_id uuid, p_ncf text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_is_final_payment boolean DEFAULT false)
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