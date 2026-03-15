
-- =============================================
-- #13: Add itbis_override_reason column to transactions
-- =============================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS itbis_override_reason text;

-- =============================================
-- #13: ITBIS validation trigger (≤ 18% unless override)
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_itbis_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if no ITBIS or no amount
  IF NEW.itbis IS NULL OR NEW.itbis = 0 OR NEW.amount IS NULL OR NEW.amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Allow override when reason is provided
  IF NEW.itbis_override_reason IS NOT NULL AND NEW.itbis_override_reason <> '' THEN
    RETURN NEW;
  END IF;

  -- Validate ITBIS ≤ 18% of amount (with small tolerance for rounding)
  IF NEW.itbis > NEW.amount * 0.18 + 0.01 THEN
    RAISE EXCEPTION 'ITBIS (%) excede 18%% del monto (%). Use itbis_override_reason para pagos acumulados.',
      NEW.itbis, NEW.amount;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_itbis_cap
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_itbis_cap();

-- =============================================
-- #11: Default exchange_rate from latest BCRD rate
-- =============================================
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
    WHERE currency_pair = 'USD_DOP'
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

CREATE TRIGGER trg_default_exchange_rate
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.default_exchange_rate();

-- =============================================
-- #12: Auto-reversal journal when transaction is voided
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_reverse_on_void()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
  v_reversal_id uuid;
BEGIN
  -- Only fire when is_void changes from false to true
  IF OLD.is_void = false AND NEW.is_void = true THEN
    -- Find any posted journal linked to this transaction
    SELECT id INTO v_journal_id
    FROM journals
    WHERE transaction_source_id = NEW.id
      AND posted = true
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
      v_reversal_id := public.create_reversal_journal(
        v_journal_id,
        CURRENT_DATE,
        'Reversión automática — transacción anulada: ' || COALESCE(NEW.description, NEW.id::text),
        auth.uid()
      );
      -- Auto-post the reversal
      PERFORM public.post_journal(v_reversal_id, auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_reverse_on_void
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (OLD.is_void = false AND NEW.is_void = true)
  EXECUTE FUNCTION public.auto_reverse_on_void();

-- =============================================
-- #14: Period status transition enforcement (one-way)
-- =============================================
CREATE OR REPLACE FUNCTION public.enforce_period_status_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  valid_transitions text[][];
  old_idx int;
  new_idx int;
  status_order text[] := ARRAY['open', 'closed', 'reported', 'locked'];
BEGIN
  -- Skip if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Find positions in the allowed order
  old_idx := array_position(status_order, OLD.status);
  new_idx := array_position(status_order, NEW.status);

  -- Must move forward only (higher index)
  IF old_idx IS NULL OR new_idx IS NULL OR new_idx <= old_idx THEN
    RAISE EXCEPTION 'Transición de estado inválida: % → %. Solo se permite avanzar (open → closed → reported → locked).',
      OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_enforce_period_status
  BEFORE UPDATE ON public.accounting_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_period_status_transition();

-- =============================================
-- #15: Server-side closing journal generation
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_closing_journal(
  p_period_id uuid,
  p_start_date date,
  p_end_date date,
  p_user_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
  v_retained_earnings_id uuid;
  v_net_income numeric := 0;
  v_bal numeric;
  rec record;
BEGIN
  -- Find retained earnings account (26xx)
  SELECT id INTO v_retained_earnings_id
  FROM chart_of_accounts
  WHERE deleted_at IS NULL
    AND account_code LIKE '26%'
    AND allow_posting = true
  ORDER BY account_code
  LIMIT 1;

  IF v_retained_earnings_id IS NULL THEN
    -- Fallback to any equity posting account
    SELECT id INTO v_retained_earnings_id
    FROM chart_of_accounts
    WHERE deleted_at IS NULL
      AND account_type = 'equity'
      AND allow_posting = true
    ORDER BY account_code
    LIMIT 1;
  END IF;

  IF v_retained_earnings_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró cuenta de utilidades retenidas (26xx)';
  END IF;

  -- Create the closing journal as draft
  INSERT INTO journals (
    journal_date, journal_type, currency, description, posted,
    created_by, period_id
  ) VALUES (
    p_end_date, 'CLJ', 'DOP',
    'Asiento de cierre — período ' || p_period_id::text,
    false, p_user_id, p_period_id
  ) RETURNING id INTO v_journal_id;

  -- Insert reversal lines for all income/expense accounts
  -- trial_balance returns balance_base = SUM((debit - credit) * exchange_rate)
  -- Revenue accounts have NEGATIVE balance_base (credits > debits)
  -- Expense accounts have POSITIVE balance_base (debits > credits)
  -- To close: reverse each → revenue gets debited, expense gets credited
  FOR rec IN
    SELECT tb.account_code, tb.balance_base, coa.id AS account_id
    FROM trial_balance(p_start_date, p_end_date) tb
    JOIN chart_of_accounts coa ON coa.account_code = tb.account_code AND coa.deleted_at IS NULL
    WHERE tb.account_type IN ('INCOME', 'EXPENSE')
      AND ABS(tb.balance_base) > 0.005
  LOOP
    v_bal := rec.balance_base;
    v_net_income := v_net_income + v_bal;

    -- Reverse the balance: positive (debit) → credit it; negative (credit) → debit it
    INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
    VALUES (
      v_journal_id, rec.account_id,
      CASE WHEN v_bal < 0 THEN ABS(v_bal) ELSE 0 END,
      CASE WHEN v_bal > 0 THEN v_bal ELSE 0 END,
      p_user_id,
      'Cierre ' || rec.account_code
    );
  END LOOP;

  -- Retained earnings: receives the net income
  -- If net_income > 0 (expenses > revenue in debit-credit convention = net loss), debit RE
  -- If net_income < 0 (revenue > expenses = net profit), credit RE
  INSERT INTO journal_lines (journal_id, account_id, debit, credit, created_by, description)
  VALUES (
    v_journal_id, v_retained_earnings_id,
    CASE WHEN v_net_income > 0 THEN v_net_income ELSE 0 END,
    CASE WHEN v_net_income < 0 THEN ABS(v_net_income) ELSE 0 END,
    p_user_id,
    'Utilidades retenidas'
  );

  RETURN v_journal_id;
END;
$function$;

-- =============================================
-- #16: Server-side recurring journal generation
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_due_recurring_journals(p_user_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_template record;
  v_journal_id uuid;
  v_next date;
BEGIN
  FOR v_template IN
    SELECT t.id, t.template_name, t.description, t.frequency,
           t.next_run_date, t.currency
    FROM recurring_journal_templates t
    WHERE t.is_active = true
      AND t.next_run_date <= CURRENT_DATE
  LOOP
    -- Create journal
    INSERT INTO journals (
      journal_date, journal_type, currency, description, posted, created_by
    ) VALUES (
      v_template.next_run_date, 'RJ', COALESCE(v_template.currency, 'DOP'),
      v_template.template_name || ' — ' || COALESCE(v_template.description, 'Recurrente'),
      false, p_user_id
    ) RETURNING id INTO v_journal_id;

    -- Copy template lines to journal lines
    INSERT INTO journal_lines (journal_id, account_id, project_code, cbs_code, debit, credit, created_by)
    SELECT v_journal_id, tl.account_id, tl.project_code, tl.cbs_code,
           tl.debit, tl.credit, p_user_id
    FROM recurring_journal_template_lines tl
    WHERE tl.template_id = v_template.id;

    -- Advance next_run_date
    IF v_template.frequency = 'biweekly' THEN
      v_next := v_template.next_run_date + interval '14 days';
    ELSE
      v_next := v_template.next_run_date + interval '1 month';
    END IF;

    UPDATE recurring_journal_templates
    SET next_run_date = v_next
    WHERE id = v_template.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
