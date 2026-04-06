
CREATE OR REPLACE FUNCTION public.update_document_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_paid numeric;
BEGIN
  SELECT total_amount INTO v_total FROM ap_ar_documents WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM ap_ar_payments WHERE document_id = COALESCE(NEW.document_id, OLD.document_id);

  UPDATE ap_ar_documents
  SET
    amount_paid = v_paid,
    status = CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'open'
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.document_id, OLD.document_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;
