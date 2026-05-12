CREATE OR REPLACE FUNCTION public.classify_service_payment_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_expense_code text;
  v_expense_acct_id uuid;
BEGIN
  SELECT NULLIF(TRIM(se.master_acct_code), ''), coa.id
  INTO v_expense_code, v_expense_acct_id
  FROM public.service_entries se
  JOIN public.chart_of_accounts coa
    ON coa.account_code = se.master_acct_code
   AND coa.allow_posting = true
   AND coa.deleted_at IS NULL
  WHERE se.id = NEW.service_entry_id;

  IF v_expense_code IS NOT NULL AND v_expense_acct_id IS NOT NULL THEN
    UPDATE public.transactions
    SET master_acct_code = v_expense_code,
        account_id = v_expense_acct_id
    WHERE id = NEW.transaction_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_classify_service_payment_transaction ON public.service_entry_payments;
CREATE TRIGGER trg_classify_service_payment_transaction
AFTER INSERT OR UPDATE OF transaction_id, service_entry_id ON public.service_entry_payments
FOR EACH ROW
WHEN (NEW.transaction_id IS NOT NULL)
EXECUTE FUNCTION public.classify_service_payment_transaction();