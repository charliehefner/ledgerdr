
CREATE OR REPLACE FUNCTION public.fn_journal_autolink_sources()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label text;
BEGIN
  IF NEW.transaction_source_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.transaction_source_id IS DISTINCT FROM NEW.transaction_source_id) THEN
    SELECT COALESCE(t.document, t.description, 'TX-' || substr(t.id::text, 1, 8))
      INTO v_label
      FROM public.transactions t
     WHERE t.id = NEW.transaction_source_id;

    INSERT INTO public.journal_source_links (journal_id, source_type, source_id, source_label)
    VALUES (NEW.id, 'transaction'::public.journal_source_type,
            NEW.transaction_source_id, v_label)
    ON CONFLICT DO NOTHING;
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

CREATE TRIGGER trg_journal_autolink_sources
AFTER INSERT OR UPDATE OF transaction_source_id ON public.journals
FOR EACH ROW EXECUTE FUNCTION public.fn_journal_autolink_sources();
