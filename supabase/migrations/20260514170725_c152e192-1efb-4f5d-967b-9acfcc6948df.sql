
-- 1) Build journal for an internal transfer transaction
CREATE OR REPLACE FUNCTION public.generate_internal_transfer_journal(p_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn         record;
  v_from_acct   uuid;
  v_to_acct     uuid;
  v_from_cur    text;
  v_to_cur      text;
  v_dest_amount numeric;
  v_journal_id  uuid;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transacción no encontrada: %', p_transaction_id;
  END IF;
  IF NOT COALESCE(v_txn.is_internal, false)
     OR v_txn.transaction_direction NOT IN ('payment','investment') THEN
    RAISE EXCEPTION 'No es una transferencia interna';
  END IF;

  SELECT chart_account_id, COALESCE(currency,'DOP')
    INTO v_from_acct, v_from_cur
  FROM public.bank_accounts WHERE id::text = v_txn.pay_method;

  SELECT chart_account_id, COALESCE(currency,'DOP')
    INTO v_to_acct, v_to_cur
  FROM public.bank_accounts WHERE id::text = v_txn.destination_acct_code;

  IF v_from_acct IS NULL OR v_to_acct IS NULL THEN
    RAISE EXCEPTION 'Cuentas bancarias origen/destino no resueltas para transferencia %', p_transaction_id;
  END IF;

  v_dest_amount := COALESCE(v_txn.destination_amount, v_txn.amount);

  INSERT INTO public.journals (
    transaction_source_id, journal_date, description,
    currency, exchange_rate, posted, entity_id, created_by
  ) VALUES (
    p_transaction_id, v_txn.transaction_date,
    COALESCE(v_txn.description, 'Transferencia interna'),
    v_from_cur, COALESCE(v_txn.exchange_rate, 1), false,
    v_txn.entity_id, auth.uid()
  )
  RETURNING id INTO v_journal_id;

  -- Credit origin bank in source currency
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description, created_by)
  VALUES (v_journal_id, v_from_acct, 0, ROUND(v_txn.amount, 2),
          'Transferencia interna — salida', auth.uid());

  -- Debit destination bank with destination amount (same as source if mono-currency)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description, created_by)
  VALUES (v_journal_id, v_to_acct, ROUND(v_dest_amount, 2), 0,
          'Transferencia interna — entrada', auth.uid());

  -- Auto-post when same-currency (debit == credit). Cross-currency stays unposted
  -- until an FX adjustment line is added by the existing FX flow.
  IF v_from_cur = v_to_cur AND ROUND(v_txn.amount,2) = ROUND(v_dest_amount,2) THEN
    PERFORM public.post_journal(v_journal_id, auth.uid());
  END IF;

  RETURN v_journal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_internal_transfer_journal(uuid) TO authenticated;

-- 2) Atomic create + journal RPC for the Internal Transfers screen
CREATE OR REPLACE FUNCTION public.create_internal_transfer(
  p_date                date,
  p_from_account        text,
  p_to_account          text,
  p_amount              numeric,
  p_destination_amount  numeric,
  p_description         text,
  p_entity_id           uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_cur     text;
  v_to_cur       text;
  v_zero_acct_id uuid;
  v_txn_id       uuid;
  v_legacy_id    integer;
  v_journal_id   uuid;
  v_desc         text;
BEGIN
  IF p_from_account IS NULL OR p_to_account IS NULL OR p_from_account = p_to_account THEN
    RAISE EXCEPTION 'Origen y destino son requeridos y no pueden ser iguales';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto debe ser mayor a cero';
  END IF;

  SELECT COALESCE(currency,'DOP') INTO v_from_cur
  FROM public.bank_accounts WHERE id::text = p_from_account;
  SELECT COALESCE(currency,'DOP') INTO v_to_cur
  FROM public.bank_accounts WHERE id::text = p_to_account;
  IF v_from_cur IS NULL OR v_to_cur IS NULL THEN
    RAISE EXCEPTION 'Cuentas bancarias origen/destino no encontradas';
  END IF;
  IF v_from_cur <> v_to_cur AND (p_destination_amount IS NULL OR p_destination_amount <= 0) THEN
    RAISE EXCEPTION 'Monto destino requerido para transferencia multi-moneda';
  END IF;

  SELECT id INTO v_zero_acct_id
  FROM public.chart_of_accounts
  WHERE account_code = '0000' AND deleted_at IS NULL
  LIMIT 1;

  v_desc := COALESCE(NULLIF(TRIM(p_description),''),
                     'Transferencia interna');

  INSERT INTO public.transactions (
    transaction_date, master_acct_code, account_id,
    description, currency, amount,
    pay_method, is_void, is_internal, cost_center,
    transaction_direction, destination_acct_code,
    destination_amount, entity_id
  )
  VALUES (
    p_date, '0000', v_zero_acct_id,
    v_desc, v_from_cur, p_amount,
    p_from_account, false, true, 'general',
    'payment', p_to_account,
    CASE WHEN v_from_cur <> v_to_cur THEN p_destination_amount ELSE NULL END,
    p_entity_id
  )
  RETURNING id, legacy_id INTO v_txn_id, v_legacy_id;

  v_journal_id := public.generate_internal_transfer_journal(v_txn_id);

  RETURN jsonb_build_object(
    'id', v_txn_id,
    'legacy_id', v_legacy_id,
    'journal_id', v_journal_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_internal_transfer(date,text,text,numeric,numeric,text,uuid) TO authenticated;

-- 3) Safe void RPC for internal transfers
CREATE OR REPLACE FUNCTION public.void_internal_transfer(
  p_transaction_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn record;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes para anular transferencia interna';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transacción no encontrada';
  END IF;
  IF COALESCE(v_txn.is_void,false) THEN
    RETURN;
  END IF;
  IF NOT COALESCE(v_txn.is_internal,false)
     OR v_txn.transaction_direction NOT IN ('payment','investment') THEN
    RAISE EXCEPTION 'No es una transferencia interna válida';
  END IF;

  -- Drop any unposted journal first so the void update can complete cleanly.
  DELETE FROM public.journal_lines
  WHERE journal_id IN (
    SELECT id FROM public.journals
    WHERE transaction_source_id = p_transaction_id
      AND COALESCE(posted,false) = false
      AND deleted_at IS NULL
  );
  DELETE FROM public.journals
  WHERE transaction_source_id = p_transaction_id
    AND COALESCE(posted,false) = false
    AND deleted_at IS NULL;

  -- Mark the transaction voided. The trg_auto_reverse_on_void trigger will
  -- create+post a reversal automatically if a posted journal exists.
  UPDATE public.transactions
  SET is_void     = true,
      void_reason = COALESCE(NULLIF(TRIM(p_reason),''), void_reason),
      voided_at   = now(),
      updated_at  = now()
  WHERE id = p_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_internal_transfer(uuid, text) TO authenticated;

-- 4) Backfill: generate journal for transfer 665 if it has none
DO $$
DECLARE
  v_id uuid := '18d4805b-7516-42d4-b3bf-ab92e05462e8';
BEGIN
  IF EXISTS (SELECT 1 FROM public.transactions WHERE id = v_id AND is_void = false)
     AND NOT EXISTS (SELECT 1 FROM public.journals WHERE transaction_source_id = v_id AND deleted_at IS NULL) THEN
    PERFORM public.generate_internal_transfer_journal(v_id);
  END IF;
END $$;
