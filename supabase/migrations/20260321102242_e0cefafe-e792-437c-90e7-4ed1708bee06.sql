
CREATE OR REPLACE FUNCTION public.default_exchange_rate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rate numeric;
BEGIN
  -- Only set if currency is not DOP and exchange_rate is null
  IF NEW.currency IS NOT NULL AND NEW.currency <> 'DOP' AND (NEW.exchange_rate IS NULL OR NEW.exchange_rate = 0) THEN
    SELECT sell_rate INTO v_rate
    FROM exchange_rates
    WHERE currency_pair = 'USD/DOP'
    ORDER BY rate_date DESC
    LIMIT 1;

    IF v_rate IS NOT NULL THEN
      NEW.exchange_rate := v_rate;
    END IF;
  END IF;

  -- DOP transactions always have exchange_rate = 1
  IF NEW.currency = 'DOP' THEN
    NEW.exchange_rate := 1;
  END IF;

  RETURN NEW;
END;
$function$;
