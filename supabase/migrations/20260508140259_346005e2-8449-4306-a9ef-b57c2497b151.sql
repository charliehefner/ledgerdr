-- Update drilldown_resolve to route Casa Matriz / CIP source types
CREATE OR REPLACE FUNCTION public.drilldown_resolve(p_journal_id uuid)
RETURNS TABLE (
  link_id uuid,
  source_type public.journal_source_type,
  source_id uuid,
  source_label text,
  route text,
  state_badge text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.source_type, l.source_id, l.source_label,
    CASE l.source_type
      WHEN 'transaction'           THEN '/transactions?id=' || l.source_id::text
      WHEN 'payroll_run'           THEN '/hr/payroll/' || l.source_id::text
      WHEN 'depreciation_entry'    THEN '/accounting?tab=fixed-assets&dep=' || l.source_id::text
      WHEN 'fixed_asset'           THEN '/accounting?tab=fixed-assets&asset=' || l.source_id::text
      WHEN 'goods_receipt'         THEN '/purchasing?gr=' || l.source_id::text
      WHEN 'purchase_order'        THEN '/purchasing?po=' || l.source_id::text
      WHEN 'bank_recon_match'      THEN '/accounting?tab=bank-recon&match=' || l.source_id::text
      WHEN 'recurring_template'    THEN NULL
      WHEN 'accrual'               THEN NULL
      WHEN 'home_office_advance'   THEN '/accounting?tab=casa-matriz&adv=' || l.source_id::text
      WHEN 'home_office_repayment' THEN '/accounting?tab=casa-matriz&rep=' || l.source_id::text
      WHEN 'home_office_accrual'   THEN '/accounting?tab=casa-matriz&acc=' || l.source_id::text
      WHEN 'home_office_fx_reval'  THEN '/accounting?tab=casa-matriz&fxr=' || l.source_id::text
      WHEN 'cip_capitalize'        THEN '/accounting?tab=cip&cap=' || l.source_id::text
      WHEN 'manual'                THEN '/accounting?tab=ledger&jid=' || p_journal_id::text
    END,
    CASE l.source_type
      WHEN 'transaction' THEN (
        SELECT CASE WHEN t.is_void THEN 'voided' ELSE 'posted' END
          FROM public.transactions t WHERE t.id = l.source_id
      )
      WHEN 'home_office_advance' THEN (
        SELECT a.status FROM public.home_office_advances a WHERE a.id = l.source_id
      )
      WHEN 'home_office_repayment' THEN (
        SELECT r.status FROM public.home_office_repayments r WHERE r.id = l.source_id
      )
      WHEN 'home_office_accrual' THEN (
        SELECT ac.status FROM public.home_office_interest_accruals ac WHERE ac.id = l.source_id
      )
      ELSE NULL
    END
  FROM public.journal_source_links l
  WHERE l.journal_id = p_journal_id
  ORDER BY l.created_at;
END;
$$;

-- Rewrite RPCs to insert source_link AFTER the row exists, with proper enum + row id

-- 1. Advance
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

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'home_office_advance'::public.journal_source_type, v_advance_id,
            'Casa Matriz ' || p_kind || ' — ' || v_party.name || ' ' || p_currency || ' ' || p_amount_fc);

  RETURN v_advance_id;
END $function$;

-- 2. Repayment
CREATE OR REPLACE FUNCTION public.post_home_office_repayment(
  p_party_id uuid,
  p_entity_id uuid,
  p_repayment_date date,
  p_currency varchar,
  p_amount_fc numeric,
  p_fx_rate numeric,
  p_bank_account_id uuid,
  p_user_id uuid,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_party        public.home_office_parties%ROWTYPE;
  v_liab_acct    uuid;
  v_fx_acct      uuid;
  v_period_id    uuid;
  v_journal_id   uuid;
  v_rep_id       uuid;
  v_paid_dop     numeric(18,2);
  v_carry_dop    numeric(18,2) := 0;
  v_realized     numeric(18,2);
  v_remaining_fc numeric;
  v_take_fc      numeric;
  v_adv          RECORD;
BEGIN
  SELECT * INTO v_party FROM public.home_office_parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Casa Matriz: party not found'; END IF;

  v_liab_acct := public._ho_acct(v_party.liability_account_code);
  v_fx_acct   := public._ho_acct(v_party.fx_account_code);
  IF v_liab_acct IS NULL OR v_fx_acct IS NULL THEN RAISE EXCEPTION 'Casa Matriz: liability/FX account missing'; END IF;
  IF p_bank_account_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: bank account required'; END IF;

  v_period_id := public._ho_resolve_period(p_repayment_date);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: no open period for %', p_repayment_date; END IF;

  v_paid_dop := ROUND(p_amount_fc * p_fx_rate, 2);

  v_remaining_fc := p_amount_fc;
  FOR v_adv IN
    SELECT id, balance_remaining_fc, fx_rate
      FROM public.home_office_advances
     WHERE party_id = p_party_id AND status = 'posted' AND balance_remaining_fc > 0
     ORDER BY advance_date, created_at
  LOOP
    EXIT WHEN v_remaining_fc <= 0;
    v_take_fc := LEAST(v_adv.balance_remaining_fc, v_remaining_fc);
    v_carry_dop := v_carry_dop + ROUND(v_take_fc * v_adv.fx_rate, 2);
    UPDATE public.home_office_advances
       SET balance_remaining_fc = balance_remaining_fc - v_take_fc
     WHERE id = v_adv.id;
    v_remaining_fc := v_remaining_fc - v_take_fc;
  END LOOP;

  IF v_remaining_fc > 0.005 THEN
    RAISE EXCEPTION 'Casa Matriz: repayment exceeds outstanding balance';
  END IF;

  v_realized := ROUND(v_paid_dop - v_carry_dop, 2);

  INSERT INTO public.journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, period_id, entity_id, journal_type, reference_description, created_by
  ) VALUES (
    p_repayment_date,
    'Casa Matriz repayment — ' || v_party.name || COALESCE(' — ' || p_description, ''),
    p_currency, p_fx_rate, true, now(), p_user_id, v_period_id, p_entity_id, 'GJ', p_reference, p_user_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description) VALUES
    (v_journal_id, v_liab_acct,        v_carry_dop, 0, 'Reducción saldo Casa Matriz'),
    (v_journal_id, p_bank_account_id,  0, v_paid_dop, 'Pago a ' || v_party.name);

  IF v_realized > 0.005 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_fx_acct, v_realized, 0, 'Pérdida en cambio realizada');
  ELSIF v_realized < -0.005 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_fx_acct, 0, abs(v_realized), 'Ganancia en cambio realizada');
  END IF;

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.home_office_repayments (
    party_id, entity_id, repayment_date, currency, amount_fc, fx_rate, amount_dop,
    realized_fx_dop, bank_account_id, reference, description, status, journal_id, created_by
  ) VALUES (
    p_party_id, p_entity_id, p_repayment_date, p_currency, p_amount_fc, p_fx_rate, v_paid_dop,
    v_realized, p_bank_account_id, p_reference, p_description, 'posted', v_journal_id, p_user_id
  ) RETURNING id INTO v_rep_id;

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'home_office_repayment'::public.journal_source_type, v_rep_id,
            'Casa Matriz repayment — ' || v_party.name || ' ' || p_currency || ' ' || p_amount_fc);

  RETURN v_rep_id;
END $$;

-- 3. Interest accrual
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

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'home_office_accrual'::public.journal_source_type, v_accrual_id,
            'Interés ' || to_char(p_period_month,'YYYY-MM') || ' — ' || v_party.name);

  RETURN v_accrual_id;
END $function$;

-- 4. Capitalize interest to principal
CREATE OR REPLACE FUNCTION public.capitalize_interest_to_principal(
  p_accrual_id uuid,
  p_user_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_acc         public.home_office_interest_accruals%ROWTYPE;
  v_party       public.home_office_parties%ROWTYPE;
  v_liab        uuid;
  v_accrual     uuid;
  v_period_id   uuid;
  v_today       date := CURRENT_DATE;
  v_journal_id  uuid;
  v_rate_today  numeric;
  v_amount_fc   numeric(18,2);
  v_new_adv_id  uuid;
BEGIN
  SELECT * INTO v_acc FROM public.home_office_interest_accruals WHERE id = p_accrual_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Accrual not found'; END IF;
  IF v_acc.status <> 'accrued' THEN RAISE EXCEPTION 'Accrual already settled (%)', v_acc.status; END IF;

  SELECT * INTO v_party FROM public.home_office_parties WHERE id = v_acc.party_id;
  v_liab    := public._ho_acct(v_party.liability_account_code);
  v_accrual := public._ho_acct(v_party.accrual_account_code);

  v_period_id := public._ho_resolve_period(v_today);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'No open period today'; END IF;

  v_rate_today := COALESCE(public.get_exchange_rate(v_party.currency, v_today, 'sell'),
                           CASE WHEN v_acc.avg_daily_balance_fc > 0
                                THEN v_acc.avg_daily_balance_dop / v_acc.avg_daily_balance_fc
                                ELSE 1 END);
  v_amount_fc := ROUND(v_acc.interest_dop / v_rate_today, 2);

  INSERT INTO public.journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, period_id, entity_id, journal_type, created_by
  ) VALUES (
    v_today,
    'Casa Matriz interest capitalized — ' || v_party.name || ' — ' || to_char(v_acc.period_month,'YYYY-MM'),
    'DOP', 1, true, now(), p_user_id, v_period_id, v_acc.entity_id, 'GJ', p_user_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
    (v_journal_id, v_accrual, v_acc.interest_dop, 0),
    (v_journal_id, v_liab,    0, v_acc.interest_dop);

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.home_office_advances (
    party_id, entity_id, advance_date, kind, currency, amount_fc, fx_rate, amount_dop,
    balance_remaining_fc, reference, description, status, journal_id, target_account_id, created_by
  ) VALUES (
    v_acc.party_id, v_acc.entity_id, v_today, 'other', v_party.currency,
    v_amount_fc, v_rate_today, v_acc.interest_dop, v_amount_fc,
    'INT-'||to_char(v_acc.period_month,'YYYY-MM'),
    'Interés capitalizado '||to_char(v_acc.period_month,'YYYY-MM'),
    'posted', v_journal_id, v_accrual, p_user_id
  ) RETURNING id INTO v_new_adv_id;

  UPDATE public.home_office_interest_accruals
     SET status='capitalized', settlement_journal_id = v_journal_id
   WHERE id = p_accrual_id;

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label) VALUES
    (v_journal_id, 'home_office_accrual'::public.journal_source_type, p_accrual_id,
        'Capitaliza interés ' || to_char(v_acc.period_month,'YYYY-MM')),
    (v_journal_id, 'home_office_advance'::public.journal_source_type, v_new_adv_id,
        'Nuevo principal por interés capitalizado');

  RETURN v_journal_id;
END $$;

-- 5. CIP capitalize
CREATE OR REPLACE FUNCTION public.capitalize_cip_project(
  p_cip_project_id uuid,
  p_target_asset_account_code text,
  p_placed_in_service_date date,
  p_useful_life_months int,
  p_salvage_value numeric,
  p_user_id uuid,
  p_asset_name text,
  p_serial_number text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cip            public.cip_projects%ROWTYPE;
  v_cip_acct       uuid;
  v_target_acct    uuid;
  v_balance_dop    numeric(18,2);
  v_period_id      uuid;
  v_journal_id     uuid;
  v_asset_id       uuid;
BEGIN
  SELECT * INTO v_cip FROM public.cip_projects WHERE id = p_cip_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CIP project not found'; END IF;
  IF v_cip.status <> 'open' THEN RAISE EXCEPTION 'CIP already %', v_cip.status; END IF;

  v_cip_acct    := public._ho_acct(v_cip.cip_account_code);
  v_target_acct := public._ho_acct(p_target_asset_account_code);
  IF v_target_acct IS NULL THEN RAISE EXCEPTION 'Target asset account % not found', p_target_asset_account_code; END IF;

  SELECT COALESCE(SUM(amount_dop), 0) INTO v_balance_dop
    FROM public.home_office_advances
   WHERE cip_project_id = p_cip_project_id AND status = 'posted';

  IF v_balance_dop <= 0 THEN RAISE EXCEPTION 'CIP project has no balance'; END IF;

  v_period_id := public._ho_resolve_period(p_placed_in_service_date);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'No open period for placed-in-service date'; END IF;

  INSERT INTO public.journals (
    journal_date, description, currency, exchange_rate,
    posted, posted_at, posted_by, period_id, entity_id, journal_type, created_by
  ) VALUES (
    p_placed_in_service_date,
    'CIP capitalize — ' || v_cip.name,
    'DOP', 1, true, now(), p_user_id, v_period_id, v_cip.entity_id, 'GJ', p_user_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
    (v_journal_id, v_target_acct, v_balance_dop, 0),
    (v_journal_id, v_cip_acct,    0, v_balance_dop);

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.fixed_assets (
    entity_id, asset_name, account_id, acquisition_date, acquisition_cost,
    salvage_value, useful_life_months, depreciation_method, status, serial_number, created_by
  ) VALUES (
    v_cip.entity_id, p_asset_name, v_target_acct, p_placed_in_service_date, v_balance_dop,
    COALESCE(p_salvage_value, 0), p_useful_life_months, 'straight_line', 'active', p_serial_number, p_user_id
  ) RETURNING id INTO v_asset_id;

  UPDATE public.cip_projects
     SET status='capitalized', placed_in_service_date = p_placed_in_service_date,
         final_asset_id = v_asset_id, capitalize_journal_id = v_journal_id
   WHERE id = p_cip_project_id;

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label) VALUES
    (v_journal_id, 'cip_capitalize'::public.journal_source_type, p_cip_project_id,
        'CIP capitalize — ' || v_cip.name),
    (v_journal_id, 'fixed_asset'::public.journal_source_type, v_asset_id,
        'CIP → ' || p_asset_name);

  RETURN v_asset_id;
END $$;

-- 6. FX Revaluation: tag both reverse + new FX journal with home_office_fx_reval
CREATE OR REPLACE FUNCTION public.revalue_open_home_office(
  p_revaluation_date date,
  p_period_id uuid,
  p_user_id uuid,
  p_entity_id uuid DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_adv          RECORD;
  v_rate         numeric;
  v_prior_rate   numeric;
  v_new_dop      numeric(18,2);
  v_orig_dop     numeric(18,2);
  v_delta        numeric(18,2);
  v_fx_acct      uuid;
  v_liab_acct    uuid;
  v_journal_id   uuid;
  v_prior        RECORD;
  v_count        integer := 0;
  v_rev_journal  uuid;
  v_fxr_id       uuid;
BEGIN
  FOR v_adv IN
    SELECT a.*, p.liability_account_code, p.fx_account_code, p.name AS party_name
      FROM public.home_office_advances a
      JOIN public.home_office_parties p ON p.id = a.party_id
     WHERE a.status = 'posted'
       AND a.balance_remaining_fc > 0
       AND a.currency <> 'DOP'
       AND (p_entity_id IS NULL OR a.entity_id = p_entity_id)
  LOOP
    v_fx_acct   := public._ho_acct(v_adv.fx_account_code);
    v_liab_acct := public._ho_acct(v_adv.liability_account_code);
    IF v_fx_acct IS NULL OR v_liab_acct IS NULL THEN CONTINUE; END IF;

    v_rate := public.get_exchange_rate(v_adv.currency, p_revaluation_date, 'sell');
    IF v_rate IS NULL OR v_rate <= 0 THEN CONTINUE; END IF;

    FOR v_prior IN
      SELECT id, journal_id FROM public.home_office_fx_revaluations
       WHERE advance_id = v_adv.id AND is_active = true FOR UPDATE
    LOOP
      INSERT INTO public.journals (
        journal_date, description, currency, exchange_rate,
        posted, posted_at, posted_by, period_id, entity_id, journal_type, reversal_of_id, created_by
      ) VALUES (
        p_revaluation_date,
        'Reverse prior FX reval — Casa Matriz '||v_adv.party_name,
        'DOP', 1, true, now(), p_user_id, p_period_id, v_adv.entity_id, 'GJ', v_prior.journal_id, p_user_id
      ) RETURNING id INTO v_rev_journal;

      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
        SELECT v_rev_journal, account_id, credit, debit
          FROM public.journal_lines
         WHERE journal_id = v_prior.journal_id AND deleted_at IS NULL;

      PERFORM public.post_journal(v_rev_journal, p_user_id);
      UPDATE public.home_office_fx_revaluations SET is_active = false WHERE id = v_prior.id;
    END LOOP;

    v_prior_rate := v_adv.fx_rate;
    v_orig_dop := ROUND(v_adv.balance_remaining_fc * v_prior_rate, 2);
    v_new_dop  := ROUND(v_adv.balance_remaining_fc * v_rate, 2);
    v_delta := v_new_dop - v_orig_dop;
    IF abs(v_delta) < 0.005 THEN CONTINUE; END IF;

    INSERT INTO public.journals (
      journal_date, description, currency, exchange_rate,
      posted, posted_at, posted_by, period_id, entity_id, journal_type, created_by
    ) VALUES (
      p_revaluation_date,
      'FX Reval — Casa Matriz ' || v_adv.party_name || ' — ' || v_adv.currency,
      'DOP', 1, true, now(), p_user_id, p_period_id, v_adv.entity_id, 'GJ', p_user_id
    ) RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
      (v_journal_id, v_fx_acct,
        CASE WHEN v_delta > 0 THEN abs(v_delta) ELSE 0 END,
        CASE WHEN v_delta < 0 THEN abs(v_delta) ELSE 0 END),
      (v_journal_id, v_liab_acct,
        CASE WHEN v_delta < 0 THEN abs(v_delta) ELSE 0 END,
        CASE WHEN v_delta > 0 THEN abs(v_delta) ELSE 0 END);

    PERFORM public.post_journal(v_journal_id, p_user_id);

    INSERT INTO public.home_office_fx_revaluations (
      advance_id, party_id, entity_id, period_id, revaluation_date,
      rate_used, prior_rate, balance_fc, dop_delta, journal_id, is_active
    ) VALUES (
      v_adv.id, v_adv.party_id, v_adv.entity_id, p_period_id, p_revaluation_date,
      v_rate, v_prior_rate, v_adv.balance_remaining_fc, v_delta, v_journal_id, true
    ) RETURNING id INTO v_fxr_id;

    UPDATE public.home_office_advances SET fx_rate = v_rate WHERE id = v_adv.id;

    INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
      VALUES (v_journal_id, 'home_office_fx_reval'::public.journal_source_type, v_fxr_id,
              'FX Reval ' || v_adv.party_name || ' ' || v_adv.currency || ' Δ ' || v_delta);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;