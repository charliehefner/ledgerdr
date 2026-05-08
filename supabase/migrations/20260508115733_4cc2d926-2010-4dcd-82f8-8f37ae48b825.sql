
-- ============================================================
-- Part A: Flexible Accounting Dimensions
-- ============================================================

CREATE TABLE public.accounting_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_es text NOT NULL,
  name_en text NOT NULL,
  is_required_default boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code)
);

CREATE INDEX idx_acc_dim_entity ON public.accounting_dimensions(entity_id) WHERE active;

CREATE TABLE public.accounting_dimension_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES public.accounting_dimensions(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_es text NOT NULL,
  name_en text NOT NULL,
  parent_value_id uuid REFERENCES public.accounting_dimension_values(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dimension_id, code)
);

CREATE INDEX idx_acc_dim_val_dim ON public.accounting_dimension_values(dimension_id) WHERE active;

CREATE TYPE public.dimension_requirement AS ENUM ('required','optional','blocked');

CREATE TABLE public.account_dimension_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.accounting_dimensions(id) ON DELETE CASCADE,
  requirement public.dimension_requirement NOT NULL DEFAULT 'optional',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, dimension_id)
);

CREATE TABLE public.journal_line_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_line_id uuid NOT NULL REFERENCES public.journal_lines(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.accounting_dimensions(id) ON DELETE CASCADE,
  dimension_value_id uuid NOT NULL REFERENCES public.accounting_dimension_values(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_line_id, dimension_id)
);

CREATE INDEX idx_jld_line  ON public.journal_line_dimensions(journal_line_id);
CREATE INDEX idx_jld_value ON public.journal_line_dimensions(dimension_value_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.accounting_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_dimension_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_dimension_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_line_dimensions ENABLE ROW LEVEL SECURITY;

-- Dimensions readable by anyone with any role on the entity (or global)
CREATE POLICY "Dimensions readable" ON public.accounting_dimensions
FOR SELECT USING (
  entity_id IS NULL
  OR public.has_role_for_entity(auth.uid(),'admin'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'management'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id)
);
CREATE POLICY "Dimensions writable by admin/accountant" ON public.accounting_dimensions
FOR ALL USING (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, COALESCE(entity_id, current_user_entity_id()))
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, COALESCE(entity_id, current_user_entity_id()))
) WITH CHECK (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, COALESCE(entity_id, current_user_entity_id()))
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, COALESCE(entity_id, current_user_entity_id()))
);

CREATE POLICY "Dimension values readable" ON public.accounting_dimension_values
FOR SELECT USING (
  entity_id IS NULL
  OR public.has_role_for_entity(auth.uid(),'admin'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'management'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id)
  OR public.has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id)
);
CREATE POLICY "Dimension values writable by admin/accountant" ON public.accounting_dimension_values
FOR ALL USING (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, COALESCE(entity_id, current_user_entity_id()))
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, COALESCE(entity_id, current_user_entity_id()))
) WITH CHECK (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, COALESCE(entity_id, current_user_entity_id()))
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, COALESCE(entity_id, current_user_entity_id()))
);

CREATE POLICY "Account dim rules readable" ON public.account_dimension_rules
FOR SELECT USING (true);
CREATE POLICY "Account dim rules admin write" ON public.account_dimension_rules
FOR ALL USING (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, current_user_entity_id())
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, current_user_entity_id())
) WITH CHECK (
  public.has_role_for_entity(auth.uid(),'admin'::app_role, current_user_entity_id())
  OR public.has_role_for_entity(auth.uid(),'accountant'::app_role, current_user_entity_id())
);

-- Journal-line dimension tags inherit from parent journal
CREATE POLICY "JLD select via journal" ON public.journal_line_dimensions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.journal_lines jl
    JOIN public.journals j ON j.id = jl.journal_id
    WHERE jl.id = journal_line_dimensions.journal_line_id
      AND (
        public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'management'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'supervisor'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'viewer'::app_role,j.entity_id)
      )
  )
);

CREATE POLICY "JLD write while unposted" ON public.journal_line_dimensions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.journal_lines jl
    JOIN public.journals j ON j.id = jl.journal_id
    WHERE jl.id = journal_line_dimensions.journal_line_id
      AND j.posted = false
      AND (
        public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journal_lines jl
    JOIN public.journals j ON j.id = jl.journal_id
    WHERE jl.id = journal_line_dimensions.journal_line_id
      AND j.posted = false
      AND (
        public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)
      )
  )
);

-- ============================================================
-- Seed cost_center dimension globally
-- ============================================================

INSERT INTO public.accounting_dimensions (entity_id, code, name_es, name_en, is_required_default, display_order)
VALUES (NULL, 'cost_center', 'Centro de costo', 'Cost Center', false, 10)
ON CONFLICT DO NOTHING;

WITH dim AS (
  SELECT id FROM public.accounting_dimensions WHERE code = 'cost_center' AND entity_id IS NULL LIMIT 1
)
INSERT INTO public.accounting_dimension_values (dimension_id, entity_id, code, name_es, name_en, display_order)
SELECT (SELECT id FROM dim), NULL, v.code, v.name_es, v.name_en, v.ord
FROM (VALUES
  ('general',      'General',      'General',      10),
  ('agricultural', 'Agrícola',     'Agricultural', 20),
  ('industrial',   'Industrial',   'Industrial',   30)
) AS v(code, name_es, name_en, ord)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Backfill journal_line_dimensions from transactions.cost_center
-- ============================================================

WITH dim AS (
  SELECT id FROM public.accounting_dimensions WHERE code = 'cost_center' AND entity_id IS NULL LIMIT 1
),
vals AS (
  SELECT code, id FROM public.accounting_dimension_values WHERE dimension_id = (SELECT id FROM dim)
)
INSERT INTO public.journal_line_dimensions (journal_line_id, dimension_id, dimension_value_id)
SELECT jl.id, (SELECT id FROM dim), v.id
  FROM public.journal_lines jl
  JOIN public.journals j         ON j.id = jl.journal_id
  JOIN public.transactions t     ON t.id = j.transaction_source_id
  JOIN vals v                    ON v.code = t.cost_center
 WHERE t.cost_center IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- Validation function (warn-only in this release)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_journal_line_dimensions(p_journal_id uuid)
RETURNS TABLE (line_id uuid, account_code text, missing_dimension text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT jl.id,
         coa.account_code,
         d.code AS missing_dimension
    FROM public.journal_lines jl
    JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
    JOIN public.account_dimension_rules r ON r.account_id = jl.account_id
    JOIN public.accounting_dimensions d ON d.id = r.dimension_id AND d.active
   WHERE jl.journal_id = p_journal_id
     AND r.requirement = 'required'
     AND NOT EXISTS (
       SELECT 1 FROM public.journal_line_dimensions jld
        WHERE jld.journal_line_id = jl.id
          AND jld.dimension_id = r.dimension_id
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_journal_line_dimensions(uuid) TO authenticated;

-- updated_at triggers (reuse generic helper if present)
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_acc_dim_updated_at BEFORE UPDATE ON public.accounting_dimensions
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_acc_dim_val_updated_at BEFORE UPDATE ON public.accounting_dimension_values
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
