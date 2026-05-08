
CREATE TYPE public.journal_source_type AS ENUM (
  'transaction','payroll_run','depreciation_entry','fixed_asset',
  'goods_receipt','purchase_order','bank_recon_match',
  'recurring_template','accrual','manual'
);

CREATE TABLE public.journal_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journals(id) ON DELETE CASCADE,
  source_type public.journal_source_type NOT NULL,
  source_id uuid NOT NULL,
  source_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, source_type, source_id)
);

CREATE INDEX idx_jsl_journal ON public.journal_source_links(journal_id);
CREATE INDEX idx_jsl_source  ON public.journal_source_links(source_type, source_id);

ALTER TABLE public.journal_source_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JSL select via journal access" ON public.journal_source_links
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.journals j
    WHERE j.id = journal_source_links.journal_id
      AND (public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'management'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'supervisor'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'viewer'::app_role,j.entity_id)))
);

CREATE POLICY "JSL insert by accountant+" ON public.journal_source_links
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.journals j
    WHERE j.id = journal_source_links.journal_id
      AND (public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'management'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)))
);

CREATE POLICY "JSL update unposted only" ON public.journal_source_links
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.journals j
    WHERE j.id = journal_source_links.journal_id AND j.posted = false
      AND (public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)))
);

CREATE POLICY "JSL delete unposted only" ON public.journal_source_links
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.journals j
    WHERE j.id = journal_source_links.journal_id AND j.posted = false
      AND (public.has_role_for_entity(auth.uid(),'admin'::app_role,j.entity_id)
        OR public.has_role_for_entity(auth.uid(),'accountant'::app_role,j.entity_id)))
);

CREATE OR REPLACE FUNCTION public.fn_jsl_immutable_after_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_posted boolean;
BEGIN
  SELECT posted INTO v_posted FROM public.journals
   WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);
  IF v_posted IS TRUE THEN
    RAISE EXCEPTION 'Cannot modify source link of a posted journal'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_jsl_immutable
BEFORE UPDATE OR DELETE ON public.journal_source_links
FOR EACH ROW EXECUTE FUNCTION public.fn_jsl_immutable_after_post();

-- Backfill from existing transaction_source_id
INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
SELECT j.id,
       'transaction'::public.journal_source_type,
       j.transaction_source_id,
       COALESCE(t.document, t.description, 'TX-' || substr(t.id::text, 1, 8))
  FROM public.journals j
  LEFT JOIN public.transactions t ON t.id = j.transaction_source_id
 WHERE j.transaction_source_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Copy source links onto reversal journals
INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
SELECT rev.id, src.source_type, src.source_id, src.source_label
  FROM public.journals rev
  JOIN public.journal_source_links src ON src.journal_id = rev.reversal_of_id
 WHERE rev.reversal_of_id IS NOT NULL
ON CONFLICT DO NOTHING;

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
      WHEN 'transaction'        THEN '/transactions?id=' || l.source_id::text
      WHEN 'payroll_run'        THEN '/hr/payroll/' || l.source_id::text
      WHEN 'depreciation_entry' THEN '/accounting/fixed-assets?dep=' || l.source_id::text
      WHEN 'fixed_asset'        THEN '/accounting/fixed-assets?asset=' || l.source_id::text
      WHEN 'goods_receipt'      THEN '/purchasing?gr=' || l.source_id::text
      WHEN 'purchase_order'     THEN '/purchasing?po=' || l.source_id::text
      WHEN 'bank_recon_match'   THEN '/accounting/bank-recon?match=' || l.source_id::text
      WHEN 'recurring_template' THEN '/accounting/recurring/' || l.source_id::text
      WHEN 'accrual'            THEN '/accounting/accruals/' || l.source_id::text
      WHEN 'manual'             THEN '/accounting/journals/' || p_journal_id::text
    END,
    CASE l.source_type
      WHEN 'transaction' THEN (
        SELECT CASE WHEN t.is_void THEN 'voided' ELSE 'posted' END
          FROM public.transactions t WHERE t.id = l.source_id
      )
      ELSE NULL
    END
  FROM public.journal_source_links l
  WHERE l.journal_id = p_journal_id
  ORDER BY l.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.drilldown_resolve(uuid) TO authenticated;
