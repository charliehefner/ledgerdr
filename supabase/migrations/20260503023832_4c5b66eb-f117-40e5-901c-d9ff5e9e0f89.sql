-- 1. Backfill account_id on existing day-labor closure transactions and any other 7690 transactions missing the FK
UPDATE public.transactions t
SET account_id = c.id
FROM public.chart_of_accounts c
WHERE t.master_acct_code = c.account_code
  AND t.account_id IS NULL
  AND c.deleted_at IS NULL;

-- 2. Replace close_day_labor_week to scope by entity and populate account_id
CREATE OR REPLACE FUNCTION public.close_day_labor_week(
  p_week_ending date,
  p_entity_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total      numeric;
  v_tx_id      uuid;
  v_count      integer;
  v_entity_id  uuid := p_entity_id;
  v_account_id uuid;
BEGIN
  -- If caller did not pass an entity, infer from the open entries (must be unique)
  IF v_entity_id IS NULL THEN
    SELECT entity_id
    INTO v_entity_id
    FROM (
      SELECT DISTINCT entity_id
      FROM day_labor_entries
      WHERE week_ending_date = p_week_ending
        AND is_closed = false
    ) s
    LIMIT 2;

    IF v_entity_id IS NULL THEN
      RAISE EXCEPTION 'No hay entradas abiertas para la semana al %', p_week_ending;
    END IF;

    -- More than one distinct entity -> require explicit p_entity_id
    PERFORM 1
    FROM day_labor_entries
    WHERE week_ending_date = p_week_ending
      AND is_closed = false
      AND entity_id IS DISTINCT FROM v_entity_id;
    IF FOUND THEN
      RAISE EXCEPTION 'Las entradas abiertas pertenecen a múltiples entidades; especifique entity_id';
    END IF;
  END IF;

  -- Permission check
  IF NOT public.user_has_entity_access(v_entity_id) THEN
    RAISE EXCEPTION 'No tiene permisos para cerrar jornales de esta entidad';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM day_labor_entries
  WHERE week_ending_date = p_week_ending
    AND entity_id = v_entity_id
    AND is_closed = false;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay entradas abiertas para la semana al % en esta entidad', p_week_ending;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.chart_of_accounts
  WHERE account_code = '7690' AND deleted_at IS NULL
  LIMIT 1;

  INSERT INTO transactions (
    transaction_date,
    master_acct_code,
    account_id,
    description,
    amount,
    currency,
    transaction_direction,
    is_internal,
    pay_method,
    entity_id
  ) VALUES (
    p_week_ending,
    '7690',
    v_account_id,
    'Jornales Semana al ' || to_char(p_week_ending, 'DD/MM/YYYY'),
    v_total,
    'DOP',
    'purchase',
    true,
    '84653770-3920-484a-8aa5-3dc8b71a0603',
    v_entity_id
  ) RETURNING id INTO v_tx_id;

  UPDATE day_labor_entries
  SET is_closed = true, updated_at = now()
  WHERE week_ending_date = p_week_ending
    AND entity_id = v_entity_id
    AND is_closed = false;

  RETURN v_tx_id;
END;
$function$;