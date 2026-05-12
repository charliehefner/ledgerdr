CREATE OR REPLACE FUNCTION public.register_service_partial_payment(
  p_service_entry_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_bank_account_id uuid,
  p_ncf text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_is_final_payment boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service          public.service_entries%ROWTYPE;
  v_provider         public.service_providers%ROWTYPE;
  v_bank             RECORD;
  v_ap_doc_id        uuid;
  v_ap_account_id    uuid;
  v_expense_acct_id  uuid;
  v_expense_code     text;
  v_total            numeric;
  v_existing_paid    numeric;
  v_is_final         boolean;
  v_create_result    jsonb;
  v_pay_result       jsonb;
  v_transaction_id   uuid;
  v_ap_payment_id    uuid;
  v_payment_id       uuid;
BEGIN
  -- Auth + permissions
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

  -- Load service + provider
  SELECT * INTO v_service FROM public.service_entries WHERE id = p_service_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Servicio no encontrado'; END IF;

  SELECT * INTO v_provider FROM public.service_providers WHERE id = v_service.provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestador no encontrado'; END IF;

  -- Validate bank
  SELECT id, account_name, bank_name, chart_account_id INTO v_bank
  FROM public.bank_accounts
  WHERE id = p_bank_account_id AND is_active = true;
  IF NOT FOUND OR v_bank.chart_account_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta bancaria inválida o sin cuenta contable asignada';
  END IF;

  v_total := COALESCE(v_service.committed_amount, v_service.amount, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Defina el monto total del servicio antes de registrar cuotas';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_existing_paid
  FROM public.service_entry_payments WHERE service_entry_id = p_service_entry_id;

  IF v_existing_paid + p_amount > v_total + 0.005 THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente del servicio';
  END IF;

  -- Resolve AP control account (2101)
  SELECT id INTO v_ap_account_id
  FROM public.chart_of_accounts
  WHERE account_code = '2101' AND allow_posting = true AND deleted_at IS NULL
  LIMIT 1;
  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta contable 2101 (Cuentas por Pagar) no encontrada';
  END IF;

  -- Resolve expense account from the service entry
  v_expense_code := NULLIF(TRIM(v_service.master_acct_code), '');
  IF v_expense_code IS NULL THEN
    RAISE EXCEPTION 'El servicio no tiene cuenta contable de gasto definida';
  END IF;
  SELECT id INTO v_expense_acct_id
  FROM public.chart_of_accounts
  WHERE account_code = v_expense_code AND allow_posting = true AND deleted_at IS NULL
  LIMIT 1;
  IF v_expense_acct_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta contable de gasto % inválida o no permite asientos', v_expense_code;
  END IF;

  -- Step 1: ensure AP document exists; create via central RPC so the bill journal
  -- (DR expense / CR 2101) is posted in one balanced entry.
  IF v_service.ap_document_id IS NULL THEN
    v_create_result := public.create_ap_ar_document(
      p_direction          => 'payable',
      p_document_type      => 'bill',
      p_contact_name       => v_provider.name,
      p_contact_rnc        => v_provider.cedula,
      p_document_number    => COALESCE(p_ncf, v_service.description),
      p_document_date      => v_service.service_date,
      p_due_date           => p_payment_date,
      p_currency           => v_service.currency,
      p_total_amount       => v_total,
      p_notes              => COALESCE(v_service.comments, 'Servicio registrado desde RRHH'),
      p_account_id         => v_ap_account_id,
      p_supplier_id        => NULL,
      p_contract_id        => NULL,
      p_entity_id          => v_service.entity_id,
      p_offset_account_id  => v_expense_acct_id,
      p_post_journal       => true,
      p_exchange_rate      => CASE WHEN v_service.currency = 'DOP' THEN 1 ELSE NULL END,
      p_user_id            => auth.uid()
    );
    v_ap_doc_id := (v_create_result->>'document_id')::uuid;

    UPDATE public.service_entries
    SET ap_document_id    = v_ap_doc_id,
        committed_amount  = v_total,
        remaining_amount  = v_total,
        settlement_status = 'open',
        updated_at        = now()
    WHERE id = v_service.id;
  ELSE
    v_ap_doc_id := v_service.ap_document_id;
  END IF;

  -- Step 2: post the payment via central RPC (DR 2101 / CR Bank, plus FX if any).
  -- This also creates the transactions row and ap_ar_payments row.
  v_pay_result := public.apply_ap_ar_payment(
    p_document_id     => v_ap_doc_id,
    p_payment_date    => p_payment_date,
    p_amount          => p_amount,
    p_bank_account_id => p_bank_account_id,
    p_user_id         => auth.uid(),
    p_exchange_rate   => CASE WHEN v_service.currency = 'DOP' THEN 1 ELSE NULL END
  );
  v_transaction_id := (v_pay_result->>'transaction_id')::uuid;
  v_ap_payment_id  := (v_pay_result->>'payment_id')::uuid;

  v_is_final := p_is_final_payment OR (v_existing_paid + p_amount + 0.005 >= v_total);

  -- Step 3: link payment back to the service entry and update its rollups.
  INSERT INTO public.service_entry_payments (
    service_entry_id, payment_date, amount, bank_account_id,
    transaction_id, ap_payment_id, ncf, notes,
    is_final_payment, created_by
  ) VALUES (
    p_service_entry_id, p_payment_date, p_amount, p_bank_account_id,
    v_transaction_id, v_ap_payment_id, p_ncf, p_notes,
    v_is_final, auth.uid()
  ) RETURNING id INTO v_payment_id;

  UPDATE public.service_entries
  SET paid_amount       = v_existing_paid + p_amount,
      remaining_amount  = v_total - (v_existing_paid + p_amount),
      settlement_status = CASE WHEN v_is_final THEN 'paid' ELSE 'partial' END,
      is_closed         = v_is_final,
      updated_at        = now()
  WHERE id = v_service.id;

  RETURN jsonb_build_object(
    'payment_id',       v_payment_id,
    'transaction_id',   v_transaction_id,
    'ap_document_id',   v_ap_doc_id,
    'ap_payment_id',    v_ap_payment_id,
    'is_final_payment', v_is_final
  );
END;
$function$;