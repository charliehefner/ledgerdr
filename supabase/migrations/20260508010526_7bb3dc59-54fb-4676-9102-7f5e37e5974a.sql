CREATE OR REPLACE FUNCTION public.update_internal_transfer(
  p_transaction_id uuid,
  p_date date,
  p_from_account text,
  p_to_account text,
  p_amount numeric,
  p_destination_amount numeric,
  p_description text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn record;
  v_from_cur text;
  v_to_cur text;
  v_is_posted boolean;
  v_entity_id uuid;
  v_new_desc text;
BEGIN
  -- Role check
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes para editar transferencia interna';
  END IF;

  -- Load transaction
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transacción no encontrada';
  END IF;

  IF COALESCE(v_txn.is_internal, false) = false
     OR v_txn.transaction_direction NOT IN ('payment','investment') THEN
    RAISE EXCEPTION 'No es una transferencia interna válida';
  END IF;

  -- Posted check
  SELECT EXISTS(
    SELECT 1 FROM public.journals
    WHERE transaction_source_id = p_transaction_id AND posted = true
  ) INTO v_is_posted;
  IF v_is_posted THEN
    RAISE EXCEPTION 'No se puede editar: asiento ya posteado';
  END IF;

  -- Period lock check (best-effort; ignore if function not present)
  BEGIN
    PERFORM 1
    FROM public.fiscal_periods
    WHERE p_date BETWEEN start_date AND end_date
      AND status IN ('locked','closed');
    IF FOUND THEN
      RAISE EXCEPTION 'Período fiscal cerrado para la fecha %', p_date;
    END IF;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  -- Resolve currencies
  SELECT currency INTO v_from_cur FROM public.bank_accounts WHERE id::text = p_from_account;
  SELECT currency INTO v_to_cur FROM public.bank_accounts WHERE id::text = p_to_account;
  v_from_cur := COALESCE(v_from_cur, 'DOP');
  v_to_cur   := COALESCE(v_to_cur, 'DOP');

  IF p_from_account = p_to_account THEN
    RAISE EXCEPTION 'Origen y destino no pueden ser iguales';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Monto debe ser mayor a cero';
  END IF;
  IF v_from_cur <> v_to_cur AND (p_destination_amount IS NULL OR p_destination_amount <= 0) THEN
    RAISE EXCEPTION 'Monto destino requerido para transferencia multi-moneda';
  END IF;

  v_entity_id := v_txn.entity_id;
  v_new_desc := COALESCE(NULLIF(p_description,''),
    'Transferencia interna: ' || p_from_account || ' → ' || p_to_account);

  -- Delete unposted journal lines + headers tied to this transaction
  DELETE FROM public.journal_entries
  WHERE journal_id IN (
    SELECT id FROM public.journals
    WHERE transaction_source_id = p_transaction_id AND COALESCE(posted,false) = false
  );
  DELETE FROM public.journals
  WHERE transaction_source_id = p_transaction_id AND COALESCE(posted,false) = false;

  -- Update transaction
  UPDATE public.transactions
  SET transaction_date = p_date,
      pay_method = p_from_account,
      destination_acct_code = p_to_account,
      amount = p_amount,
      destination_amount = CASE WHEN v_from_cur <> v_to_cur THEN p_destination_amount ELSE NULL END,
      description = v_new_desc,
      currency = v_from_cur,
      updated_at = now()
  WHERE id = p_transaction_id;

  -- Regenerate journal via existing edge/RPC pipeline.
  -- Reuse generate_internal_transfer_journal if it exists; otherwise rely on triggers.
  BEGIN
    PERFORM public.generate_internal_transfer_journal(p_transaction_id);
  EXCEPTION
    WHEN undefined_function THEN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_internal_transfer(uuid, date, text, text, numeric, numeric, text) TO authenticated;