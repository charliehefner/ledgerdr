
-- Fix: prevent_posting_closed_period references is_closed which was dropped.
-- Replace with status-based checks consistent with the period locking system.

CREATE OR REPLACE FUNCTION public.prevent_posting_closed_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND status IN ('closed', 'reported', 'locked')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot modify journal in a closed accounting period';
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
$function$;
