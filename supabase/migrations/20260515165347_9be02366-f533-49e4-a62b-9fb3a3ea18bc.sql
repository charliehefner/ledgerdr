-- 1. Fix Security Definer View
ALTER VIEW public.employees_safe SET (security_invoker = on);

-- 2. Fix Function Search Path Mutable
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;

-- 3. Revoke EXECUTE from anon / PUBLIC on all SECURITY DEFINER functions in public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- 4. Tighten app_error_log INSERT policy (replace USING/WITH CHECK true)
DROP POLICY IF EXISTS "Authenticated users can log errors" ON public.app_error_log;
CREATE POLICY "Authenticated users can log errors"
ON public.app_error_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
