
-- Casa Matriz (Home Office Loans) — core data model + RPCs

CREATE TABLE IF NOT EXISTS public.home_office_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES public.entities(id),
  name text NOT NULL,
  tax_id text,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  interest_rate_pct numeric(8,4) NOT NULL DEFAULT 0,
  interest_basis text NOT NULL DEFAULT 'actual/365' CHECK (interest_basis IN ('actual/360','actual/365','30/360','none')),
  compounding text NOT NULL DEFAULT 'simple' CHECK (compounding IN ('simple','monthly')),
  liability_account_code text NOT NULL DEFAULT '2160',
  accrual_account_code text NOT NULL DEFAULT '2960',
  expense_account_code text NOT NULL DEFAULT '8460',
  fx_account_code text NOT NULL DEFAULT '8510',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_home_office_parties_entity ON public.home_office_parties(entity_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cip_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  name text NOT NULL,
  cip_account_code text NOT NULL CHECK (cip_account_code IN ('1080','1180','1280')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','capitalized','cancelled')),
  placed_in_service_date date,
  final_asset_id uuid REFERENCES public.fixed_assets(id),
  capitalize_journal_id uuid REFERENCES public.journals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cip_projects_entity ON public.cip_projects(entity_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.home_office_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.home_office_parties(id),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  advance_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash_transfer','equipment_capitalize','equipment_cip','equipment_inventory','expense_paid_on_behalf','other')),
  currency varchar(3) NOT NULL,
  amount_fc numeric(18,2) NOT NULL CHECK (amount_fc > 0),
  fx_rate numeric(14,6) NOT NULL CHECK (fx_rate > 0),
  amount_dop numeric(18,2) NOT NULL,
  balance_remaining_fc numeric(18,2) NOT NULL,
  reference text,
  description text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','voided')),
  journal_id uuid REFERENCES public.journals(id),
  transaction_id uuid REFERENCES public.transactions(id),
  fixed_asset_id uuid REFERENCES public.fixed_assets(id),
  cip_project_id uuid REFERENCES public.cip_projects(id),
  bank_account_id uuid,
  target_account_id uuid REFERENCES public.chart_of_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ho_advances_party ON public.home_office_advances(party_id) WHERE status <> 'voided';
CREATE INDEX IF NOT EXISTS idx_ho_advances_entity ON public.home_office_advances(entity_id);
CREATE INDEX IF NOT EXISTS idx_ho_advances_date ON public.home_office_advances(advance_date);

CREATE TABLE IF NOT EXISTS public.home_office_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.home_office_parties(id),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  repayment_date date NOT NULL,
  kind text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash','offset','write_off')),
  currency varchar(3) NOT NULL,
  amount_fc numeric(18,2) NOT NULL CHECK (amount_fc > 0),
  fx_rate numeric(14,6) NOT NULL CHECK (fx_rate > 0),
  amount_dop numeric(18,2) NOT NULL,
  realized_fx_dop numeric(18,2) NOT NULL DEFAULT 0,
  bank_account_id uuid,
  reference text,
  description text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  journal_id uuid REFERENCES public.journals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ho_repayments_party ON public.home_office_repayments(party_id) WHERE status <> 'voided';

CREATE TABLE IF NOT EXISTS public.home_office_interest_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.home_office_parties(id),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  period_month date NOT NULL,
  avg_daily_balance_fc numeric(18,2) NOT NULL DEFAULT 0,
  avg_daily_balance_dop numeric(18,2) NOT NULL DEFAULT 0,
  rate_pct numeric(8,4) NOT NULL,
  days integer NOT NULL,
  basis_days integer NOT NULL,
  interest_fc numeric(18,2) NOT NULL,
  interest_dop numeric(18,2) NOT NULL,
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','capitalized','paid','voided')),
  journal_id uuid REFERENCES public.journals(id),
  settlement_journal_id uuid REFERENCES public.journals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (party_id, period_month)
);

CREATE TABLE IF NOT EXISTS public.home_office_fx_revaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.home_office_advances(id),
  party_id uuid NOT NULL REFERENCES public.home_office_parties(id),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id),
  revaluation_date date NOT NULL,
  rate_used numeric(14,6) NOT NULL,
  prior_rate numeric(14,6) NOT NULL,
  balance_fc numeric(18,2) NOT NULL,
  dop_delta numeric(18,2) NOT NULL,
  journal_id uuid REFERENCES public.journals(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ho_fx_reval_active ON public.home_office_fx_revaluations(advance_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ho_fx_reval_period ON public.home_office_fx_revaluations(period_id);

CREATE TRIGGER trg_ho_parties_updated BEFORE UPDATE ON public.home_office_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ho_advances_updated BEFORE UPDATE ON public.home_office_advances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cip_projects_updated BEFORE UPDATE ON public.cip_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.home_office_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_office_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_office_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_office_interest_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_office_fx_revaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cip_projects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'home_office_parties','home_office_advances','home_office_repayments',
    'home_office_interest_accruals','home_office_fx_revaluations','cip_projects'
  ])
  LOOP
    EXECUTE format($f$
      CREATE POLICY "Admin full access" ON public.%I FOR ALL TO authenticated
        USING (has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
        WITH CHECK (has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Mgmt full access" ON public.%I FOR ALL TO authenticated
        USING (has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
        WITH CHECK (has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Accountant full access" ON public.%I FOR ALL TO authenticated
        USING (has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
        WITH CHECK (has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Supervisor read" ON public.%I FOR SELECT TO authenticated
        USING (has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Viewer read" ON public.%I FOR SELECT TO authenticated
        USING (has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id));
    $f$, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._ho_acct(p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.chart_of_accounts
   WHERE account_code = p_code AND allow_posting = true AND deleted_at IS NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._ho_resolve_period(p_date date)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.accounting_periods
   WHERE p_date >= start_date AND p_date <= end_date
     AND status = 'open' AND deleted_at IS NULL
   ORDER BY start_date DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.post_home_office_advance(
  p_party_id uuid,
  p_entity_id uuid,
  p_advance_date date,
  p_kind text,
  p_currency varchar,
  p_amount_fc numeric,
  p_fx_rate numeric,
  p_target_account_id uuid,
  p_user_id uuid,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL,
  p_fixed_asset_id uuid DEFAULT NULL,
  p_cip_project_id uuid DEFAULT NULL,
  p_bank_account_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    transaction_id, fixed_asset_id, cip_project_id, bank_account_id, target_account_id, created_by
  ) VALUES (
    p_party_id, p_entity_id, p_advance_date, p_kind, p_currency, p_amount_fc, p_fx_rate, v_amount_dop,
    p_amount_fc, p_reference, p_description, 'posted', v_journal_id,
    p_transaction_id, p_fixed_asset_id, p_cip_project_id, p_bank_account_id, p_target_account_id, p_user_id
  ) RETURNING id INTO v_advance_id;

  RETURN v_advance_id;
END $$;

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

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'manual', p_party_id, 'Casa Matriz repayment — ' || v_party.name);

  INSERT INTO public.home_office_repayments (
    party_id, entity_id, repayment_date, currency, amount_fc, fx_rate, amount_dop,
    realized_fx_dop, bank_account_id, reference, description, status, journal_id, created_by
  ) VALUES (
    p_party_id, p_entity_id, p_repayment_date, p_currency, p_amount_fc, p_fx_rate, v_paid_dop,
    v_realized, p_bank_account_id, p_reference, p_description, 'posted', v_journal_id, p_user_id
  ) RETURNING id INTO v_rep_id;

  RETURN v_rep_id;
END $$;

CREATE OR REPLACE FUNCTION public.post_home_office_interest_accrual(
  p_party_id uuid,
  p_entity_id uuid,
  p_period_month date,
  p_user_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_party       public.home_office_parties%ROWTYPE;
  v_expense     uuid;
  v_accrual     uuid;
  v_period_end  date;
  v_period_id   uuid;
  v_days        int;
  v_basis_days  int;
  v_avg_fc      numeric(18,2);
  v_avg_dop     numeric(18,2);
  v_interest_fc numeric(18,2);
  v_interest_dop numeric(18,2);
  v_journal_id  uuid;
  v_accrual_id  uuid;
BEGIN
  SELECT * INTO v_party FROM public.home_office_parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Casa Matriz: party not found'; END IF;
  IF v_party.interest_basis = 'none' OR COALESCE(v_party.interest_rate_pct, 0) = 0 THEN
    RAISE EXCEPTION 'Casa Matriz: party has no interest configured';
  END IF;

  v_period_end := (date_trunc('month', p_period_month) + interval '1 month - 1 day')::date;
  v_period_id  := public._ho_resolve_period(v_period_end);
  IF v_period_id IS NULL THEN RAISE EXCEPTION 'Casa Matriz: no open period for %', v_period_end; END IF;

  v_days := EXTRACT(day FROM v_period_end)::int;
  v_basis_days := CASE v_party.interest_basis WHEN 'actual/360' THEN 360 WHEN '30/360' THEN 360 ELSE 365 END;

  SELECT COALESCE(SUM(balance_remaining_fc), 0),
         COALESCE(SUM(balance_remaining_fc * fx_rate), 0)
    INTO v_avg_fc, v_avg_dop
    FROM public.home_office_advances
   WHERE party_id = p_party_id AND status = 'posted';

  IF v_avg_fc <= 0 THEN RAISE EXCEPTION 'Casa Matriz: no outstanding principal'; END IF;

  v_interest_fc  := ROUND(v_avg_fc  * (v_party.interest_rate_pct/100.0) * v_days / v_basis_days, 2);
  v_interest_dop := ROUND(v_avg_dop * (v_party.interest_rate_pct/100.0) * v_days / v_basis_days, 2);

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
    (v_journal_id, v_expense, v_interest_dop, 0, 'Interés '||to_char(p_period_month,'YYYY-MM')),
    (v_journal_id, v_accrual, 0, v_interest_dop, 'Interés devengado '||v_party.name);

  PERFORM public.post_journal(v_journal_id, p_user_id);

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'accrual', p_party_id, 'Casa Matriz interest — '||v_party.name);

  INSERT INTO public.home_office_interest_accruals (
    party_id, entity_id, period_month, avg_daily_balance_fc, avg_daily_balance_dop,
    rate_pct, days, basis_days, interest_fc, interest_dop, status, journal_id, created_by
  ) VALUES (
    p_party_id, p_entity_id, date_trunc('month', p_period_month)::date, v_avg_fc, v_avg_dop,
    v_party.interest_rate_pct, v_days, v_basis_days, v_interest_fc, v_interest_dop, 'accrued', v_journal_id, p_user_id
  ) RETURNING id INTO v_accrual_id;

  RETURN v_accrual_id;
END $$;

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

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'manual', p_accrual_id, 'Capitaliza interés Casa Matriz');

  INSERT INTO public.home_office_advances (
    party_id, entity_id, advance_date, kind, currency, amount_fc, fx_rate, amount_dop,
    balance_remaining_fc, reference, description, status, journal_id, target_account_id, created_by
  ) VALUES (
    v_acc.party_id, v_acc.entity_id, v_today, 'other', v_party.currency,
    v_amount_fc, v_rate_today, v_acc.interest_dop, v_amount_fc,
    'INT-'||to_char(v_acc.period_month,'YYYY-MM'),
    'Interés capitalizado '||to_char(v_acc.period_month,'YYYY-MM'),
    'posted', v_journal_id, v_accrual, p_user_id
  );

  UPDATE public.home_office_interest_accruals
     SET status='capitalized', settlement_journal_id = v_journal_id
   WHERE id = p_accrual_id;

  RETURN v_journal_id;
END $$;

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

  INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (v_journal_id, 'fixed_asset', v_asset_id, 'CIP → ' || p_asset_name);

  UPDATE public.cip_projects
     SET status='capitalized', placed_in_service_date = p_placed_in_service_date,
         final_asset_id = v_asset_id, capitalize_journal_id = v_journal_id
   WHERE id = p_cip_project_id;

  RETURN v_asset_id;
END $$;

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
    );

    UPDATE public.home_office_advances SET fx_rate = v_rate WHERE id = v_adv.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

CREATE OR REPLACE VIEW public.home_office_balance AS
SELECT
  p.id AS party_id,
  p.entity_id,
  p.name,
  p.currency,
  COALESCE(SUM(a.balance_remaining_fc), 0)::numeric(18,2) AS principal_fc,
  COALESCE(SUM(a.balance_remaining_fc * a.fx_rate), 0)::numeric(18,2) AS principal_dop,
  COALESCE((SELECT SUM(interest_dop) FROM public.home_office_interest_accruals
             WHERE party_id = p.id AND status = 'accrued'), 0)::numeric(18,2) AS accrued_interest_dop
FROM public.home_office_parties p
LEFT JOIN public.home_office_advances a
  ON a.party_id = p.id AND a.status = 'posted' AND a.balance_remaining_fc > 0
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.entity_id, p.name, p.currency;

INSERT INTO public.home_office_parties (name, currency, interest_rate_pct, interest_basis, compounding, notes)
SELECT 'JORD AB', 'USD', 4.0, 'actual/365', 'simple', 'Casa Matriz - Suecia'
WHERE NOT EXISTS (SELECT 1 FROM public.home_office_parties WHERE name = 'JORD AB');
