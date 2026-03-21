
CREATE OR REPLACE FUNCTION public.close_day_labor_week(p_week_ending date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
  v_tx_id uuid;
  v_count integer;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM day_labor_entries
  WHERE week_ending_date = p_week_ending
    AND is_closed = false;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay entradas abiertas para la semana al %', p_week_ending;
  END IF;

  INSERT INTO transactions (
    transaction_date,
    master_acct_code,
    description,
    amount,
    currency,
    transaction_direction,
    is_internal,
    pay_method
  ) VALUES (
    p_week_ending,
    '7690',
    'Jornales Semana al ' || to_char(p_week_ending, 'DD/MM/YYYY'),
    v_total,
    'DOP',
    'purchase',
    true,
    '84653770-3920-484a-8aa5-3dc8b71a0603'
  ) RETURNING id INTO v_tx_id;

  UPDATE day_labor_entries
  SET is_closed = true, updated_at = now()
  WHERE week_ending_date = p_week_ending
    AND is_closed = false;

  RETURN v_tx_id;
END;
$$;
