-- Fix audit trigger to cast id properly
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id::uuid, auth.uid(), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id::uuid, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO accounting_audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id::uuid, auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;