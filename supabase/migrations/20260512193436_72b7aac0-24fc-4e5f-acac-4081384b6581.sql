
-- Helper: ensure an OPEN monthly accounting period exists for a given date.
-- If the date already falls in any period (open/closed/locked/etc.), do nothing.
-- Otherwise, create the calendar-month period as 'open'.
CREATE OR REPLACE FUNCTION public.ensure_open_monthly_period(p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id          uuid;
  v_start       date;
  v_end         date;
  v_name        text;
  v_month_es    text;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM accounting_periods
  WHERE p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_start := date_trunc('month', p_date)::date;
  v_end   := (v_start + INTERVAL '1 month - 1 day')::date;

  v_month_es := CASE EXTRACT(MONTH FROM v_start)::int
    WHEN 1 THEN 'Enero'    WHEN 2 THEN 'Febrero' WHEN 3 THEN 'Marzo'
    WHEN 4 THEN 'Abril'    WHEN 5 THEN 'Mayo'    WHEN 6 THEN 'Junio'
    WHEN 7 THEN 'Julio'    WHEN 8 THEN 'Agosto'  WHEN 9 THEN 'Septiembre'
    WHEN 10 THEN 'Octubre' WHEN 11 THEN 'Noviembre' WHEN 12 THEN 'Diciembre'
  END;
  v_name := v_month_es || ' ' || EXTRACT(YEAR FROM v_start)::text;

  INSERT INTO accounting_periods (period_name, start_date, end_date, status, is_closed)
  VALUES (v_name, v_start, v_end, 'open', false)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM accounting_periods
    WHERE start_date = v_start AND end_date = v_end AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

-- Wire auto-creation into the posting guard so a missing period is created on demand.
CREATE OR REPLACE FUNCTION public.prevent_posting_closed_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND status IN ('closed', 'reported', 'locked')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot modify journal in a closed accounting period';
  END IF;

  -- Auto-create the calendar-month period as 'open' if none exists yet.
  IF NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND deleted_at IS NULL
  ) THEN
    PERFORM public.ensure_open_monthly_period(NEW.journal_date::date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND status = 'open'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No open accounting period exists for date %', NEW.journal_date;
  END IF;

  RETURN NEW;
END;
$$;

-- Daily helper: ensure both the current month and the next month are open.
CREATE OR REPLACE FUNCTION public.ensure_current_and_next_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.ensure_open_monthly_period(CURRENT_DATE);
  PERFORM public.ensure_open_monthly_period((date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date);
END;
$$;
