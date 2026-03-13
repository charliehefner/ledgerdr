
-- Generic audit trigger function that logs INSERT/UPDATE/DELETE to accounting_audit_log
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id::text, auth.uid(), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id::text, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id::text, auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to critical accounting tables
CREATE TRIGGER audit_journals
  AFTER INSERT OR UPDATE OR DELETE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_journal_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_chart_of_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_fixed_assets
  AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_bank_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_accounting_periods
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_bank_statement_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
