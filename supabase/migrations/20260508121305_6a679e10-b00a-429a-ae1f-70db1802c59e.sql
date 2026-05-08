-- Update drilldown_resolve routes to existing pages
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
      WHEN 'depreciation_entry' THEN '/accounting?tab=fixed-assets&dep=' || l.source_id::text
      WHEN 'fixed_asset'        THEN '/accounting?tab=fixed-assets&asset=' || l.source_id::text
      WHEN 'goods_receipt'      THEN '/purchasing?gr=' || l.source_id::text
      WHEN 'purchase_order'     THEN '/purchasing?po=' || l.source_id::text
      WHEN 'bank_recon_match'   THEN '/accounting?tab=bank-recon&match=' || l.source_id::text
      WHEN 'recurring_template' THEN NULL
      WHEN 'accrual'            THEN NULL
      WHEN 'manual'             THEN '/accounting?tab=ledger&jid=' || p_journal_id::text
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

-- Extend autolink trigger to also tag cost_center dimension values on each new journal line
CREATE OR REPLACE FUNCTION public.fn_journal_autolink_sources()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_label text;
  v_dim_id uuid;
  v_val_id uuid;
  v_cc text;
BEGIN
  IF NEW.transaction_source_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.transaction_source_id IS DISTINCT FROM NEW.transaction_source_id) THEN
    SELECT COALESCE(t.document, t.description, 'TX-' || substr(t.id::text, 1, 8)),
           t.cost_center
      INTO v_label, v_cc
      FROM public.transactions t
     WHERE t.id = NEW.transaction_source_id;

    INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (NEW.id, 'transaction'::public.journal_source_type,
            NEW.transaction_source_id, v_label)
    ON CONFLICT DO NOTHING;

    -- Auto-tag cost_center dimension on every line of this journal
    IF v_cc IS NOT NULL THEN
      SELECT d.id INTO v_dim_id
        FROM public.accounting_dimensions d
       WHERE d.code = 'cost_center' AND d.entity_id IS NULL
       LIMIT 1;

      IF v_dim_id IS NOT NULL THEN
        SELECT v.id INTO v_val_id
          FROM public.accounting_dimension_values v
         WHERE v.dimension_id = v_dim_id AND v.code = v_cc
         LIMIT 1;

        IF v_val_id IS NOT NULL THEN
          INSERT INTO public.journal_line_dimensions (journal_line_id, dimension_id, dimension_value_id)
          SELECT jl.id, v_dim_id, v_val_id
            FROM public.journal_lines jl
           WHERE jl.journal_id = NEW.id
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Copy source links from parent when this is a reversal
  IF TG_OP = 'INSERT' AND NEW.reversal_of_id IS NOT NULL THEN
    INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    SELECT NEW.id, src.source_type, src.source_id, src.source_label
      FROM public.journal_source_links src
     WHERE src.journal_id = NEW.reversal_of_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Also tag dimensions when journal_lines are inserted AFTER the journal already exists
CREATE OR REPLACE FUNCTION public.fn_journal_line_autotag_cc()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dim_id uuid;
  v_val_id uuid;
  v_cc text;
BEGIN
  SELECT t.cost_center INTO v_cc
    FROM public.journals j
    JOIN public.transactions t ON t.id = j.transaction_source_id
   WHERE j.id = NEW.journal_id;

  IF v_cc IS NULL THEN RETURN NEW; END IF;

  SELECT d.id INTO v_dim_id
    FROM public.accounting_dimensions d
   WHERE d.code = 'cost_center' AND d.entity_id IS NULL
   LIMIT 1;

  IF v_dim_id IS NULL THEN RETURN NEW; END IF;

  SELECT v.id INTO v_val_id
    FROM public.accounting_dimension_values v
   WHERE v.dimension_id = v_dim_id AND v.code = v_cc
   LIMIT 1;

  IF v_val_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.journal_line_dimensions (journal_line_id, dimension_id, dimension_value_id)
  VALUES (NEW.id, v_dim_id, v_val_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jl_autotag_cc ON public.journal_lines;
CREATE TRIGGER trg_jl_autotag_cc
AFTER INSERT ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.fn_journal_line_autotag_cc();