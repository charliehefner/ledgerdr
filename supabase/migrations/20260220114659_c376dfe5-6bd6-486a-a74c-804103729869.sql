
-- Add status column as TEXT with check constraint
ALTER TABLE public.accounting_periods
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- Add check constraint for valid values
ALTER TABLE public.accounting_periods
  ADD CONSTRAINT chk_period_status CHECK (status IN ('open', 'closed', 'reported', 'locked'));

-- Backfill from is_closed
UPDATE public.accounting_periods
SET status = CASE WHEN is_closed = true THEN 'closed' ELSE 'open' END;

-- Trigger: prevent mutations on transactions in locked/reported periods
CREATE OR REPLACE FUNCTION public.prevent_transaction_in_locked_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_status text;
  v_tx_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN v_tx_date := OLD.transaction_date;
  ELSE v_tx_date := NEW.transaction_date;
  END IF;

  SELECT ap.status INTO v_status
  FROM accounting_periods ap
  WHERE v_tx_date BETWEEN ap.start_date AND ap.end_date
    AND ap.deleted_at IS NULL
  LIMIT 1;

  IF v_status IN ('locked', 'reported') THEN
    RAISE EXCEPTION 'Cannot modify transactions in a % period', v_status;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_transactions_by_period ON public.transactions;
CREATE TRIGGER trg_lock_transactions_by_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_in_locked_period();

-- Trigger: prevent mutations on timesheets in locked/reported periods
CREATE OR REPLACE FUNCTION public.prevent_timesheet_in_locked_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_status text;
  v_work_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN v_work_date := OLD.work_date;
  ELSE v_work_date := NEW.work_date;
  END IF;

  SELECT ap.status INTO v_status
  FROM accounting_periods ap
  WHERE v_work_date BETWEEN ap.start_date AND ap.end_date
    AND ap.deleted_at IS NULL
  LIMIT 1;

  IF v_status IN ('locked', 'reported') THEN
    RAISE EXCEPTION 'Cannot modify timesheets in a % period', v_status;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_timesheets_by_period ON public.employee_timesheets;
CREATE TRIGGER trg_lock_timesheets_by_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.employee_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_timesheet_in_locked_period();

-- Sync trigger: keep is_closed in sync with status
CREATE OR REPLACE FUNCTION public.sync_period_status_to_is_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.is_closed := NEW.status IN ('closed', 'reported', 'locked');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_period_status ON public.accounting_periods;
CREATE TRIGGER trg_sync_period_status
  BEFORE INSERT OR UPDATE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.sync_period_status_to_is_closed();
