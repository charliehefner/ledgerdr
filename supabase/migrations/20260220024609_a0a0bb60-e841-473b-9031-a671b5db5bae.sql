-- Fix all functions without search_path set to prevent schema poisoning

CREATE OR REPLACE FUNCTION public.check_period_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE id != NEW.id
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Accounting period overlaps with an existing period';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_postable_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chart_of_accounts
    WHERE id = NEW.account_id
      AND allow_posting = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post to non-postable account: %', NEW.account_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_journal_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines
  WHERE journal_id = NEW.journal_id AND deleted_at IS NULL;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal not balanced: debit = %, credit = %',
      total_debit, total_credit;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_posting_closed_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND is_closed = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot modify journal in a closed accounting period';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND is_closed = false
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No open accounting period exists for date %', NEW.journal_date;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_edit_posted_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.posted = true AND OLD.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Posted journals cannot be modified or deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_edit_posted_journal_line()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
BEGIN
  v_journal_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.journal_id END,
    OLD.journal_id
  );

  IF EXISTS (
    SELECT 1 FROM journals
    WHERE id = v_journal_id
      AND posted = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lines of posted journals cannot be modified or deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_accounting_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_journal_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  seq_num bigint;
BEGIN
  SELECT nextval('journals_journal_number_seq') INTO seq_num;
  NEW.journal_number = 'GJ-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_journal(p_journal_id uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE journal_id = p_journal_id AND deleted_at IS NULL;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Cannot post unbalanced journal';
  END IF;

  UPDATE journals
  SET posted    = true,
      posted_by = p_user,
      posted_at = now()
  WHERE id = p_journal_id AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reversal_journal(p_original_journal_id uuid, p_reversal_date date, p_description text, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_journal_id uuid;
  orig_currency varchar(3);
  orig_exchange_rate numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM journals
    WHERE id = p_original_journal_id AND posted = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Can only reverse posted journals';
  END IF;

  SELECT currency, exchange_rate INTO orig_currency, orig_exchange_rate
  FROM journals WHERE id = p_original_journal_id;

  INSERT INTO journals (
    journal_date, description, currency, exchange_rate, posted,
    reversal_of_id, created_by
  )
  VALUES (
    p_reversal_date, p_description, orig_currency, orig_exchange_rate,
    false, p_original_journal_id, p_created_by
  )
  RETURNING id INTO new_journal_id;

  INSERT INTO journal_lines (
    journal_id, account_id, debit, credit, tax_code_id, project_code,
    cbs_code, created_by
  )
  SELECT
    new_journal_id, account_id, credit, debit, tax_code_id, project_code,
    cbs_code, p_created_by
  FROM journal_lines
  WHERE journal_id = p_original_journal_id AND deleted_at IS NULL;

  RETURN new_journal_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_journal_from_transaction(p_transaction_id uuid, p_date date, p_description text, p_created_by uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_journal uuid;
BEGIN
  INSERT INTO journals (
    transaction_source_id, journal_date, description, posted, created_by
  )
  VALUES (p_transaction_id, p_date, p_description, false, p_created_by)
  RETURNING id INTO new_journal;

  RETURN new_journal;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trial_balance(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
 RETURNS TABLE(account_code character varying, account_name text, account_type text, total_debit_base numeric, total_credit_base numeric, balance_base numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(l.debit * j.exchange_rate)  AS total_debit_base,
    SUM(l.credit * j.exchange_rate) AS total_credit_base,
    SUM((l.debit - l.credit) * j.exchange_rate) AS balance_base
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id
  JOIN journals j ON j.id = l.journal_id AND j.posted = true
  WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_code;
$function$;

CREATE OR REPLACE FUNCTION public.income_statement(p_start date, p_end date)
 RETURNS TABLE(account_type text, total_income numeric, total_expense numeric, net_result numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_type,
    SUM(CASE WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * j.exchange_rate ELSE 0 END) AS total_income,
    SUM(CASE WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * j.exchange_rate ELSE 0 END) AS total_expense,
    SUM(CASE WHEN a.account_type IN ('INCOME','EXPENSE') THEN (l.credit - l.debit) * j.exchange_rate ELSE 0 END) AS net_result
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_type;
$function$;

CREATE OR REPLACE FUNCTION public.income_statement_detail(p_start date, p_end date)
 RETURNS TABLE(account_code character varying, account_name text, account_type text, total_amount numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(
      CASE
        WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * j.exchange_rate
        WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * j.exchange_rate
        ELSE 0
      END
    ) AS total_amount
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_type, a.account_code;
$function$;

CREATE OR REPLACE FUNCTION public.dgii_507_report(p_start date, p_end date)
 RETURNS TABLE(journal_date date, transaction_id uuid, dgii_code character varying, retained_amount numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    j.journal_date,
    j.transaction_source_id,
    t.dgii_code,
    l.credit * j.exchange_rate AS retained_amount_base
  FROM journal_lines l
  JOIN tax_codes t ON t.id = l.tax_code_id AND t.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.deleted_at IS NULL
  WHERE t.affects_isr = true
    AND j.posted = true
    AND j.journal_date BETWEEN p_start AND p_end
    AND l.deleted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.dgii_509_report(p_start date, p_end date)
 RETURNS TABLE(journal_date date, transaction_id uuid, dgii_code character varying, itbis_withheld numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT
    j.journal_date,
    j.transaction_source_id,
    t.dgii_code,
    l.credit * j.exchange_rate AS itbis_withheld_base
  FROM journal_lines l
  JOIN tax_codes t ON t.id = l.tax_code_id AND t.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.deleted_at IS NULL
  WHERE t.affects_itbis = true
    AND j.posted = true
    AND j.journal_date BETWEEN p_start AND p_end
    AND l.deleted_at IS NULL;
$function$;