
-- 1. Fix data: only the open period should be current
UPDATE payroll_periods SET is_current = false WHERE status != 'open';

-- 2. Trigger: enforce single is_current and auto-clear on close
CREATE OR REPLACE FUNCTION public.enforce_single_current_payroll_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-clear is_current when period is closed
  IF NEW.status != 'open' THEN
    NEW.is_current := false;
  END IF;

  -- If marking as current, unset all others
  IF NEW.is_current = true THEN
    UPDATE payroll_periods
    SET is_current = false
    WHERE id != NEW.id AND is_current = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_current_period
  BEFORE INSERT OR UPDATE ON payroll_periods
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_current_payroll_period();
