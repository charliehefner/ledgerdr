ALTER TABLE public.accounting_periods
ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false;

UPDATE public.accounting_periods
SET is_closed = CASE
  WHEN status IN ('closed', 'reported', 'locked') THEN true
  ELSE false
END
WHERE is_closed IS DISTINCT FROM CASE
  WHEN status IN ('closed', 'reported', 'locked') THEN true
  ELSE false
END;

CREATE OR REPLACE FUNCTION public.sync_period_status_to_is_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_closed := NEW.status IN ('closed', 'reported', 'locked');
  RETURN NEW;
END;
$function$;