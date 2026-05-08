
ALTER TABLE public.home_office_advances
  ADD COLUMN IF NOT EXISTS interest_rate_pct numeric(8,4),
  ADD COLUMN IF NOT EXISTS interest_basis text
    CHECK (interest_basis IN ('actual/365','actual/360','30/360','none'));

COMMENT ON COLUMN public.home_office_advances.interest_rate_pct IS 'Per-advance override. NULL = inherit party rate. 0 = explicit zero (e.g. equipment).';
COMMENT ON COLUMN public.home_office_advances.interest_basis IS 'Per-advance override. NULL = inherit party basis.';

-- Rewrite advance posting RPC to accept per-advance rate/basis
CREATE OR REPLACE FUNCTION public.post_home_office_advance(
  p_party_id uuid, p_entity_id uuid, p_advance_date date, p_kind text,
  p_currency character varying, p_amount_fc numeric, p_fx_rate numeric,
  p_target_account_id uuid, p_user_id uuid,
  p_reference text DEFAULT NULL, p_description text DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL, p_fixed_asset_id uuid DEFAULT NULL,
  p_cip_project_id uuid DEFAULT NULL, p_bank_account_id uuid DEFAULT NULL,
  p_interest_rate_pct numeric DEFAULT NULL,
  p_interest_basis text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_party       public.home_office_parties%ROWTYPE;
  v_amount_dop  numeric(18,2);
  v_liab_acct   uuid;
  v_period_id   uuid;
  v_journal_id  uuid;
  v_advance_id  uuid;
BEGIN
  SELECT * INTO v_party FROM public.home_office_parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Casa Matriz: party not found'; END IF;
  IF p_target_account_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: target_account_id required'; END IF;

  v_liab_acct := public._ho_acct(v_party.liability_account_code);
  IF v_liab_acct IS NULL THEN RAISE EXCEPTION 'Casa Matriz: liability account % missing', v_party.liability_account_code; END IF;

  v_period_id := public._ho_resolve_period(p_advance_date);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: no open period for %', p_advance_date; END IF;

  v_amount_dop := ROUND(p_amount_fc * p_fx_rate, 2);

  INSERT INTO public.journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, period_id, entity_id, journal_type, reference_description, created_by
  ) VALUES (
    p_advance_date,
    'Casa Matriz — ' || v_party.name || ' (' || p_kind || ')' || COALESCE(' — ' || p_description, ''),
    p_currency, p_fx_rate,
    true, now(), p_user_id, v_period_id, p_entity_id, 'GJ', p_reference, p_user_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (v_journal_id, p_target_account_id, v_amount_dop, 0, COALESCE(p_description, p_kind)),
    (v_journal_id, v_liab_acct,         0, v_amount_dop, v_party.name || ' — ' || p_currency || ' ' || p_amount_fc);

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'manual', p_party_id, 'Casa Matriz advance — ' || v_party.name);

  INSERT INTO public.home_office_advances (
    party_id, entity_id, advance_date, kind, currency, amount_fc, fx_rate, amount_dop,
    balance_remaining_fc, reference, description, status, journal_id,
    transaction_id, fixed_asset_id, cip_project_id, bank_account_id, target_account_id,
    interest_rate_pct, interest_basis, created_by
  ) VALUES (
    p_party_id, p_entity_id, p_advance_date, p_kind, p_currency, p_amount_fc, p_fx_rate, v_amount_dop,
    p_amount_fc, p_reference, p_description, 'posted', v_journal_id,
    p_transaction_id, p_fixed_asset_id, p_cip_project_id, p_bank_account_id, p_target_account_id,
    p_interest_rate_pct, p_interest_basis, p_user_id
  ) RETURNING id INTO v_advance_id;

  RETURN v_advance_id;
END $function$;

-- Rewrite accrual to compute per-advance, then sum
CREATE OR REPLACE FUNCTION public.post_home_office_interest_accrual(
  p_party_id uuid, p_entity_id uuid, p_period_month date, p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_party       public.home_office_parties%ROWTYPE;
  v_expense     uuid;
  v_accrual     uuid;
  v_period_end  date;
  v_period_id   uuid;
  v_days        int;
  v_total_fc    numeric(18,2) := 0;
  v_total_dop   numeric(18,2) := 0;
  v_principal_fc  numeric(18,2) := 0;
  v_principal_dop numeric(18,2) := 0;
  v_journal_id  uuid;
  v_accrual_id  uuid;
  r             record;
  v_rate        numeric;
  v_basis       text;
  v_basis_days  int;
  v_int_fc      numeric(18,2);
  v_int_dop     numeric(18,2);
BEGIN
  SELECT * INTO v_party FROM public.home_office_parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Casa Matriz: party not found'; END IF;

  v_period_end := (date_trunc('month', p_period_month) + interval '1 month - 1 day')::date;
  v_period_id  := public._ho_resolve_period(v_period_end);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: no open period for %', v_period_end; END IF;

  v_days := EXTRACT(day FROM v_period_end)::int;

  FOR r IN
    SELECT id, balance_remaining_fc, fx_rate,
           interest_rate_pct, interest_basis
      FROM public.home_office_advances
     WHERE party_id = p_party_id
       AND entity_id = p_entity_id
       AND status = 'posted'
       AND balance_remaining_fc > 0
  LOOP
    v_principal_fc  := v_principal_fc + r.balance_remaining_fc;
    v_principal_dop := v_principal_dop + ROUND(r.balance_remaining_fc * r.fx_rate, 2);

    v_rate  := COALESCE(r.interest_rate_pct, v_party.interest_rate_pct);
    v_basis := COALESCE(r.interest_basis, v_party.interest_basis);
    IF v_rate IS NULL OR v_rate = 0 OR v_basis = 'none' THEN CONTINUE; END IF;

    v_basis_days := CASE v_basis WHEN 'actual/360' THEN 360 WHEN '30/360' THEN 360 ELSE 365 END;
    v_int_fc  := ROUND(r.balance_remaining_fc                * (v_rate/100.0) * v_days / v_basis_days, 2);
    v_int_dop := ROUND(r.balance_remaining_fc * r.fx_rate    * (v_rate/100.0) * v_days / v_basis_days, 2);

    v_total_fc  := v_total_fc  + v_int_fc;
    v_total_dop := v_total_dop + v_int_dop;
  END LOOP;

  IF v_total_dop <= 0 THEN
    RAISE EXCEPTION 'Casa Matriz: no interest to accrue for % / %', v_party.name, to_char(p_period_month,'YYYY-MM');
  END IF;

  v_expense := public._ho_acct(v_party.expense_account_code);
  v_accrual := public._ho_acct(v_party.accrual_account_code);

  INSERT INTO public.journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, period_id, entity_id, journal_type, created_by
  ) VALUES (
    v_period_end,
    'Casa Matriz interest accrual — ' || v_party.name || ' — ' || to_char(p_period_month,'YYYY-MM'),
    'DOP', 1, true, now(), p_user_id, v_period_id, p_entity_id, 'GJ', p_user_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (v_journal_id, v_expense, v_total_dop, 0, 'Interés '||to_char(p_period_month,'YYYY-MM')),
    (v_journal_id, v_accrual, 0, v_total_dop, 'Interés devengado '||v_party.name);

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'accrual', p_party_id, 'Casa Matriz interest — '||v_party.name);

  INSERT INTO public.home_office_interest_accruals (
    party_id, entity_id, period_month, avg_daily_balance_fc, avg_daily_balance_dop,
    rate_pct, days, basis_days, interest_fc, interest_dop, status, journal_id, created_by
  ) VALUES (
    p_party_id, p_entity_id, date_trunc('month', p_period_month)::date,
    v_principal_fc, v_principal_dop,
    v_party.interest_rate_pct, v_days,
    CASE v_party.interest_basis WHEN 'actual/360' THEN 360 WHEN '30/360' THEN 360 ELSE 365 END,
    v_total_fc, v_total_dop, 'accrued', v_journal_id, p_user_id
  ) RETURNING id INTO v_accrual_id;

  RETURN v_accrual_id;
END $function$;
