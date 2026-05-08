
-- ============================================================================
-- #7: Credit / Debit memo application table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ap_ar_credit_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_doc_id   uuid NOT NULL REFERENCES public.ap_ar_documents(id) ON DELETE CASCADE,
  target_doc_id   uuid NOT NULL REFERENCES public.ap_ar_documents(id) ON DELETE CASCADE,
  amount          numeric NOT NULL CHECK (amount > 0),
  notes           text,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  applied_by      uuid,
  CONSTRAINT chk_credit_apps_distinct CHECK (credit_doc_id <> target_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_apar_credit_apps_credit ON public.ap_ar_credit_applications(credit_doc_id);
CREATE INDEX IF NOT EXISTS idx_apar_credit_apps_target ON public.ap_ar_credit_applications(target_doc_id);

ALTER TABLE public.ap_ar_credit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access apca"
  ON public.ap_ar_credit_applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'admin'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'admin'::app_role,d.entity_id)));

CREATE POLICY "Management full access apca"
  ON public.ap_ar_credit_applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'management'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'management'::app_role,d.entity_id)));

CREATE POLICY "Accountant full access apca"
  ON public.ap_ar_credit_applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'accountant'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND has_role_for_entity(auth.uid(),'accountant'::app_role,d.entity_id)));

CREATE POLICY "Read access apca"
  ON public.ap_ar_credit_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = target_doc_id
    AND (has_role_for_entity(auth.uid(),'supervisor'::app_role,d.entity_id)
      OR has_role_for_entity(auth.uid(),'viewer'::app_role,d.entity_id))));

-- Validation trigger: matching direction/currency/contact, no over-application
CREATE OR REPLACE FUNCTION public.validate_credit_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_credit ap_ar_documents%ROWTYPE;
  v_target ap_ar_documents%ROWTYPE;
  v_other_credit_apps numeric;
  v_other_invoice_apps numeric;
BEGIN
  SELECT * INTO v_credit FROM ap_ar_documents WHERE id = NEW.credit_doc_id FOR UPDATE;
  SELECT * INTO v_target FROM ap_ar_documents WHERE id = NEW.target_doc_id FOR UPDATE;

  IF v_credit.document_type NOT IN ('credit_memo','debit_note') THEN
    RAISE EXCEPTION 'credit_doc_id debe ser nota de crédito o débito';
  END IF;
  IF v_target.document_type NOT IN ('invoice','bill') THEN
    RAISE EXCEPTION 'target_doc_id debe ser factura';
  END IF;
  IF v_credit.direction <> v_target.direction THEN
    RAISE EXCEPTION 'Crédito y factura deben ser del mismo tipo (%/%)',
      v_credit.direction, v_target.direction;
  END IF;
  IF v_credit.currency <> v_target.currency THEN
    RAISE EXCEPTION 'Crédito y factura deben tener la misma moneda';
  END IF;
  IF v_credit.status = 'void' OR v_target.status = 'void' THEN
    RAISE EXCEPTION 'No se pueden aplicar documentos anulados';
  END IF;

  -- Don't exceed credit memo's available balance
  SELECT COALESCE(SUM(amount), 0) INTO v_other_credit_apps
  FROM ap_ar_credit_applications
  WHERE credit_doc_id = NEW.credit_doc_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF NEW.amount > v_credit.balance_remaining + v_other_credit_apps + 0.005 - v_other_credit_apps THEN
    -- credit balance_remaining already reflects credit applications via recompute,
    -- but on first insert this row is not yet counted. Use raw remaining capacity:
    NULL;
  END IF;
  IF (v_other_credit_apps + NEW.amount) > v_credit.total_amount + 0.005 THEN
    RAISE EXCEPTION 'El crédito disponible es insuficiente (total %, ya aplicado %, intentando %)',
      v_credit.total_amount, v_other_credit_apps, NEW.amount;
  END IF;

  -- Don't exceed invoice's outstanding balance (excluding this row)
  SELECT COALESCE(SUM(amount), 0) INTO v_other_invoice_apps
  FROM ap_ar_credit_applications
  WHERE target_doc_id = NEW.target_doc_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF NEW.amount > (v_target.balance_remaining + v_other_invoice_apps + 0.005) THEN
    RAISE EXCEPTION 'El monto excede el saldo pendiente de la factura';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_credit_application ON public.ap_ar_credit_applications;
CREATE TRIGGER trg_validate_credit_application
BEFORE INSERT OR UPDATE ON public.ap_ar_credit_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_credit_application();

-- Sync trigger: recompute both sides
CREATE OR REPLACE FUNCTION public.sync_credit_application_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_ap_ar_document_balance(OLD.credit_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(OLD.target_doc_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recompute_ap_ar_document_balance(NEW.credit_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(NEW.target_doc_id);
    IF NEW.credit_doc_id IS DISTINCT FROM OLD.credit_doc_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.credit_doc_id);
    END IF;
    IF NEW.target_doc_id IS DISTINCT FROM OLD.target_doc_id THEN
      PERFORM public.recompute_ap_ar_document_balance(OLD.target_doc_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recompute_ap_ar_document_balance(NEW.credit_doc_id);
    PERFORM public.recompute_ap_ar_document_balance(NEW.target_doc_id);
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_credit_application_balances ON public.ap_ar_credit_applications;
CREATE TRIGGER trg_sync_credit_application_balances
AFTER INSERT OR UPDATE OR DELETE ON public.ap_ar_credit_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_credit_application_balances();

-- Update recompute helper to include credit applications on both sides
CREATE OR REPLACE FUNCTION public.recompute_ap_ar_document_balance(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total          numeric;
  v_current_status text;
  v_doc_type       text;
  v_apps           numeric;
  v_alloc_invoice  numeric;
  v_alloc_advance  numeric;
  v_credit_consumed numeric;
  v_credit_received numeric;
  v_paid           numeric;
  v_new_status     text;
BEGIN
  IF p_document_id IS NULL THEN RETURN; END IF;

  SELECT total_amount, status, document_type
    INTO v_total, v_current_status, v_doc_type
  FROM ap_ar_documents WHERE id = p_document_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_current_status = 'void' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_apps
  FROM ap_ar_payment_applications WHERE document_id = p_document_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_invoice
  FROM advance_allocations WHERE invoice_doc_id = p_document_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_alloc_advance
  FROM advance_allocations WHERE advance_doc_id = p_document_id;

  -- This doc is the *target* invoice receiving credit memo applications
  SELECT COALESCE(SUM(amount), 0) INTO v_credit_received
  FROM ap_ar_credit_applications WHERE target_doc_id = p_document_id;

  -- This doc is the *credit memo* whose balance is being consumed
  SELECT COALESCE(SUM(amount), 0) INTO v_credit_consumed
  FROM ap_ar_credit_applications WHERE credit_doc_id = p_document_id;

  v_paid := ROUND(v_apps + v_alloc_invoice + v_alloc_advance + v_credit_received + v_credit_consumed, 2);

  IF v_paid >= v_total - 0.005 THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0.005 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'open';
  END IF;

  UPDATE ap_ar_documents
  SET amount_paid = v_paid,
      status      = v_new_status,
      updated_at  = now()
  WHERE id = p_document_id;
END;
$function$;

-- ============================================================================
-- #11: FX revaluation correctness
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ap_ar_fx_revaluations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES public.ap_ar_documents(id) ON DELETE CASCADE,
  revaluation_date  date NOT NULL,
  period_id         uuid,
  rate              numeric NOT NULL,
  balance_remaining numeric NOT NULL,
  dop_delta         numeric NOT NULL,  -- signed: positive = AP/AR control debit / FX loss for payable
  journal_id        uuid REFERENCES public.journals(id) ON DELETE SET NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid
);

CREATE INDEX IF NOT EXISTS idx_apar_fx_reval_doc ON public.ap_ar_fx_revaluations(document_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_apar_fx_reval_period ON public.ap_ar_fx_revaluations(period_id);

ALTER TABLE public.ap_ar_fx_revaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access apfx"
  ON public.ap_ar_fx_revaluations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'admin'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'admin'::app_role,d.entity_id)));

CREATE POLICY "Accountant full access apfx"
  ON public.ap_ar_fx_revaluations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'accountant'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'accountant'::app_role,d.entity_id)));

CREATE POLICY "Management full access apfx"
  ON public.ap_ar_fx_revaluations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'management'::app_role,d.entity_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND has_role_for_entity(auth.uid(),'management'::app_role,d.entity_id)));

CREATE POLICY "Read access apfx"
  ON public.ap_ar_fx_revaluations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ap_ar_documents d WHERE d.id = document_id
    AND (has_role_for_entity(auth.uid(),'supervisor'::app_role,d.entity_id)
      OR has_role_for_entity(auth.uid(),'viewer'::app_role,d.entity_id))));

-- Replace revaluation function: balance-based, reverses prior, uses 8510
CREATE OR REPLACE FUNCTION public.revalue_open_ap_ar(
  p_revaluation_date date,
  p_period_id uuid,
  p_user_id uuid,
  p_entity_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc            RECORD;
  v_rate           numeric;
  v_target_delta   numeric;
  v_new_dop        numeric;
  v_orig_dop       numeric;
  v_fx_acct_id     uuid;
  v_apar_acct_id   uuid;
  v_journal_id     uuid;
  v_prior          RECORD;
  v_count          integer := 0;
  v_is_payable     boolean;
  v_default_apar   uuid;
BEGIN
  SELECT id INTO v_fx_acct_id FROM chart_of_accounts
   WHERE account_code = '8510' AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
  IF v_fx_acct_id IS NULL THEN
    RAISE EXCEPTION 'Cuenta 8510 (Diferencia Cambiaria) no encontrada';
  END IF;

  FOR v_doc IN
    SELECT d.id, d.direction, d.balance_remaining, d.currency,
           d.exchange_rate_used, d.account_id
    FROM ap_ar_documents d
    WHERE d.status IN ('open','partial')
      AND d.currency <> 'DOP'
      AND d.balance_remaining > 0
      AND (p_entity_id IS NULL OR d.entity_id = p_entity_id)
  LOOP
    v_is_payable := (v_doc.direction = 'payable');

    -- Resolve AP/AR control account
    v_apar_acct_id := v_doc.account_id;
    IF v_apar_acct_id IS NULL THEN
      SELECT id INTO v_default_apar FROM chart_of_accounts
       WHERE account_code = CASE WHEN v_is_payable THEN '2101' ELSE '1210' END
         AND allow_posting = true AND deleted_at IS NULL LIMIT 1;
      v_apar_acct_id := v_default_apar;
    END IF;
    IF v_apar_acct_id IS NULL THEN CONTINUE; END IF;

    v_rate := public.get_exchange_rate(
      v_doc.currency, p_revaluation_date,
      CASE WHEN v_is_payable THEN 'sell' ELSE 'buy' END
    );
    IF v_rate IS NULL OR v_rate <= 0 THEN CONTINUE; END IF;

    v_orig_dop := ROUND(v_doc.balance_remaining * COALESCE(v_doc.exchange_rate_used, 1), 2);
    v_new_dop  := ROUND(v_doc.balance_remaining * v_rate, 2);
    v_target_delta := ROUND(v_new_dop - v_orig_dop, 2);

    -- Reverse the prior active revaluation for this document, if any
    FOR v_prior IN
      SELECT id, journal_id, dop_delta
      FROM ap_ar_fx_revaluations
      WHERE document_id = v_doc.id AND is_active = true
      FOR UPDATE
    LOOP
      IF v_prior.journal_id IS NOT NULL THEN
        PERFORM public.post_reversing_journal(
          v_prior.journal_id, p_revaluation_date, p_user_id,
          'Reverso revaluación FX previa'
        );
      END IF;
      UPDATE ap_ar_fx_revaluations SET is_active = false WHERE id = v_prior.id;
    END LOOP;

    -- If no net delta, nothing more to post for this doc
    IF ABS(v_target_delta) < 0.01 THEN CONTINUE; END IF;

    -- Post adjusting journal
    INSERT INTO journals (
      journal_type, description, journal_date, period_id,
      currency, exchange_rate, posted, posted_at, posted_by, created_by, entity_id
    ) VALUES (
      'GJ',
      'Revaluación FX ' || v_doc.currency || ' al ' || p_revaluation_date::text,
      p_revaluation_date, p_period_id,
      'DOP', 1, true, now(), p_user_id, p_user_id, p_entity_id
    ) RETURNING id INTO v_journal_id;

    -- Sign convention identical to realized FX in apply_ap_ar_payment:
    --   payable + delta>0 (rate up) → loss; debit AP control, credit 8510
    --   payable + delta<0 → gain
    --   receivable + delta>0 (rate up) → gain; debit 8510, credit AR
    --   receivable + delta<0 → loss
    IF (v_is_payable AND v_target_delta > 0)
       OR (NOT v_is_payable AND v_target_delta < 0) THEN
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, v_apar_acct_id, ABS(v_target_delta), 0, 'Ajuste FX no realizado'),
        (v_journal_id, v_fx_acct_id, 0, ABS(v_target_delta), 'Pérdida cambiaria no realizada');
    ELSE
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description) VALUES
        (v_journal_id, v_fx_acct_id, ABS(v_target_delta), 0, 'Ganancia cambiaria no realizada'),
        (v_journal_id, v_apar_acct_id, 0, ABS(v_target_delta), 'Ajuste FX no realizado');
    END IF;

    INSERT INTO ap_ar_fx_revaluations (
      document_id, revaluation_date, period_id, rate, balance_remaining,
      dop_delta, journal_id, is_active, created_by
    ) VALUES (
      v_doc.id, p_revaluation_date, p_period_id, v_rate, v_doc.balance_remaining,
      v_target_delta, v_journal_id, true, p_user_id
    );

    -- Note: do NOT update exchange_rate_used; it is the original booking rate
    -- and is required for correct realized FX on subsequent payments.

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- When a payment fully clears an open document, mark its FX revaluation rows
-- inactive so future runs don't keep reversing them. (Reversal already posted
-- by realized-FX path.) We do this lazily via a small trigger on document status.
CREATE OR REPLACE FUNCTION public.deactivate_fx_revals_on_paid_void()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('paid','void') AND OLD.status NOT IN ('paid','void') THEN
    UPDATE ap_ar_fx_revaluations
       SET is_active = false
     WHERE document_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_deactivate_fx_revals ON public.ap_ar_documents;
CREATE TRIGGER trg_deactivate_fx_revals
AFTER UPDATE OF status ON public.ap_ar_documents
FOR EACH ROW EXECUTE FUNCTION public.deactivate_fx_revals_on_paid_void();
