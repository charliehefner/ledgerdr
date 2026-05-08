
-- Drop the older overload (without interest params) so callers always hit the new one
DROP FUNCTION IF EXISTS public.post_home_office_advance(
  uuid, uuid, date, text, character varying, numeric, numeric, uuid, uuid,
  text, text, uuid, uuid, uuid, uuid
);

-- Trigger: deactivate open FX reval rows when an advance is fully repaid or voided
CREATE OR REPLACE FUNCTION public.deactivate_ho_fx_revals_on_settle_or_void()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'voided' OR (NEW.balance_remaining_fc <= 0 AND COALESCE(OLD.balance_remaining_fc,0) > 0) THEN
      UPDATE public.home_office_fx_revaluations
         SET is_active = false
       WHERE advance_id = NEW.id AND is_active = true;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ho_deactivate_fx_revals ON public.home_office_advances;
CREATE TRIGGER trg_ho_deactivate_fx_revals
AFTER UPDATE ON public.home_office_advances
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_ho_fx_revals_on_settle_or_void();
