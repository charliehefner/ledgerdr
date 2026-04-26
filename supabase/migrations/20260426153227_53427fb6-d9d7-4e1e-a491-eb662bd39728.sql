-- ============================================================
-- Phase 1: Posting Rules engine
-- ============================================================

-- Main rules table
CREATE TABLE public.posting_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid REFERENCES public.entities(id) ON DELETE CASCADE,  -- NULL = global
  name        text NOT NULL,
  description text,
  priority    integer NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true,
  conditions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions     jsonb NOT NULL DEFAULT '{}'::jsonb,
  applies_to  text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('transaction_entry','bank_quick_entry','both')),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_posting_rules_entity_priority
  ON public.posting_rules (entity_id, priority)
  WHERE is_active = true;

CREATE INDEX idx_posting_rules_global_priority
  ON public.posting_rules (priority)
  WHERE is_active = true AND entity_id IS NULL;

ALTER TABLE public.posting_rules ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated role that uses the form/journals
CREATE POLICY "posting_rules_read"
  ON public.posting_rules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "posting_rules_insert"
  ON public.posting_rules FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE POLICY "posting_rules_update"
  ON public.posting_rules FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE POLICY "posting_rules_delete"
  ON public.posting_rules FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE TRIGGER trg_posting_rules_updated_at
  BEFORE UPDATE ON public.posting_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE public.posting_rule_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         uuid NOT NULL REFERENCES public.posting_rules(id) ON DELETE CASCADE,
  transaction_id  uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  context         text NOT NULL DEFAULT 'transaction_entry',
  applied_fields  jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at      timestamptz NOT NULL DEFAULT now(),
  applied_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_pra_transaction ON public.posting_rule_applications (transaction_id);
CREATE INDEX idx_pra_rule        ON public.posting_rule_applications (rule_id);

ALTER TABLE public.posting_rule_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pra_read"
  ON public.posting_rule_applications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'management'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE POLICY "pra_insert"
  ON public.posting_rule_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Evaluator
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_posting_rules(
  p_entity_id uuid,
  p_payload   jsonb
)
RETURNS TABLE (
  rule_id   uuid,
  rule_name text,
  priority  integer,
  actions   jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor   text := COALESCE(p_payload->>'vendor', '');
  v_desc     text := COALESCE(p_payload->>'description', '');
  v_doc      text := COALESCE(p_payload->>'document', '');
  v_amount   numeric := NULLIF(p_payload->>'amount','')::numeric;
  v_currency text := COALESCE(p_payload->>'currency', '');
  v_type     text := COALESCE(p_payload->>'transaction_type', '');
  v_context  text := COALESCE(p_payload->>'context', 'transaction_entry');
BEGIN
  RETURN QUERY
  SELECT r.id, r.name, r.priority, r.actions
  FROM public.posting_rules r
  WHERE r.is_active = true
    AND (r.entity_id IS NULL OR r.entity_id = p_entity_id)
    AND (r.applies_to = 'both' OR r.applies_to = v_context)
    -- vendor regex
    AND (
      NOT (r.conditions ? 'vendor_regex')
      OR NULLIF(r.conditions->>'vendor_regex','') IS NULL
      OR (v_vendor <> '' AND v_vendor ~* (r.conditions->>'vendor_regex'))
    )
    -- description regex
    AND (
      NOT (r.conditions ? 'description_regex')
      OR NULLIF(r.conditions->>'description_regex','') IS NULL
      OR (v_desc <> '' AND v_desc ~* (r.conditions->>'description_regex'))
    )
    -- ncf prefix (array of accepted prefixes)
    AND (
      NOT (r.conditions ? 'ncf_prefix')
      OR jsonb_array_length(COALESCE(r.conditions->'ncf_prefix','[]'::jsonb)) = 0
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(r.conditions->'ncf_prefix') prefix
        WHERE v_doc ILIKE prefix || '%'
      )
    )
    -- amount range
    AND (
      NOT (r.conditions ? 'amount_min')
      OR NULLIF(r.conditions->>'amount_min','') IS NULL
      OR (v_amount IS NOT NULL AND v_amount >= (r.conditions->>'amount_min')::numeric)
    )
    AND (
      NOT (r.conditions ? 'amount_max')
      OR NULLIF(r.conditions->>'amount_max','') IS NULL
      OR (v_amount IS NOT NULL AND v_amount <= (r.conditions->>'amount_max')::numeric)
    )
    -- currency (array)
    AND (
      NOT (r.conditions ? 'currency')
      OR jsonb_array_length(COALESCE(r.conditions->'currency','[]'::jsonb)) = 0
      OR (v_currency <> '' AND r.conditions->'currency' ? v_currency)
    )
    -- transaction type (array: purchase/sale/payment)
    AND (
      NOT (r.conditions ? 'transaction_type')
      OR jsonb_array_length(COALESCE(r.conditions->'transaction_type','[]'::jsonb)) = 0
      OR (v_type <> '' AND r.conditions->'transaction_type' ? v_type)
    )
  ORDER BY (r.entity_id IS NULL) ASC,  -- entity-specific before global
           r.priority ASC,
           r.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_posting_rules(uuid, jsonb) TO authenticated;

-- ============================================================
-- Seed: replace QuickEntryDialog hardcoded AUTO_RULES as global rules
-- ============================================================
INSERT INTO public.posting_rules (entity_id, name, description, priority, conditions, actions, applies_to)
VALUES
  (NULL, 'Comisión bancaria → 6520',
    'Reconoce comisiones bancarias en las líneas de extracto bancario',
    50,
    jsonb_build_object('description_regex', 'COMISI[OÓ]N'),
    jsonb_build_object('master_account_code', '6520'),
    'both'),
  (NULL, 'Impuesto Ley → 6530',
    'Reconoce impuesto a la ley monetaria en las líneas de extracto bancario',
    50,
    jsonb_build_object('description_regex', 'IMPUESTO\s*LEY'),
    jsonb_build_object('master_account_code', '6530'),
    'both'),
  (NULL, 'ITBIS → 1650',
    'Reconoce ITBIS pagado en las líneas de extracto bancario',
    50,
    jsonb_build_object('description_regex', 'ITBIS'),
    jsonb_build_object('master_account_code', '1650'),
    'both'),
  (NULL, 'Intereses → 6510',
    'Reconoce gastos por intereses en las líneas de extracto bancario',
    50,
    jsonb_build_object('description_regex', 'INTER[EÉ]S'),
    jsonb_build_object('master_account_code', '6510'),
    'both');