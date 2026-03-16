
-- Finding 6: Void AP/AR documents when linked transaction is voided
CREATE OR REPLACE FUNCTION public.void_ap_ar_on_transaction_void()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when is_void changes from false to true
  IF OLD.is_void = false AND NEW.is_void = true THEN
    UPDATE ap_ar_documents
    SET status = 'void', updated_at = now()
    WHERE linked_transaction_ids @> ARRAY[NEW.id]::uuid[];
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_void_ap_ar_on_transaction_void
  AFTER UPDATE OF is_void ON public.transactions
  FOR EACH ROW
  WHEN (OLD.is_void = false AND NEW.is_void = true)
  EXECUTE FUNCTION public.void_ap_ar_on_transaction_void();
