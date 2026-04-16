CREATE OR REPLACE FUNCTION public.void_ap_ar_on_transaction_void()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_void = false AND NEW.is_void = true THEN
    UPDATE public.ap_ar_documents AS d
    SET status = 'void', updated_at = now()
    WHERE EXISTS (
      SELECT 1
      FROM public.ap_ar_document_transactions AS l
      WHERE l.document_id = d.id
        AND l.transaction_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_void_ap_ar_on_transaction_void ON public.transactions;

CREATE TRIGGER trg_void_ap_ar_on_transaction_void
  AFTER UPDATE OF is_void ON public.transactions
  FOR EACH ROW
  WHEN (OLD.is_void = false AND NEW.is_void = true)
  EXECUTE FUNCTION public.void_ap_ar_on_transaction_void();