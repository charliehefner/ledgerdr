
-- ============================================
-- 1. APP ERROR LOG TABLE
-- ============================================
CREATE TABLE public.app_error_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NULL,
  error_message text NOT NULL,
  stack_trace text NULL,
  page_url text NULL,
  user_agent text NULL,
  component_name text NULL
);

ALTER TABLE public.app_error_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert errors (fire-and-forget logging)
CREATE POLICY "Authenticated users can log errors"
  ON public.app_error_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only admin/management can read error logs
CREATE POLICY "Admins can read error logs"
  ON public.app_error_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management')
  );

-- Only admin can delete error logs
CREATE POLICY "Admins can delete error logs"
  ON public.app_error_log FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. FIX contact_bank_accounts SELECT policy
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view contact bank accounts" ON public.contact_bank_accounts;

CREATE POLICY "Authorized roles can view contact bank accounts"
  ON public.contact_bank_accounts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'management') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- ============================================
-- 3. FIX bank_statement_lines: add entity scoping
-- ============================================
DROP POLICY IF EXISTS "Authorized roles can view bank statement lines" ON public.bank_statement_lines;
DROP POLICY IF EXISTS "Authenticated users can view bank statements" ON public.bank_statement_lines;

CREATE POLICY "Entity-scoped users can view bank statement lines"
  ON public.bank_statement_lines FOR SELECT TO authenticated
  USING (
    public.is_global_admin() OR
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_statement_lines.bank_account_id
        AND public.user_has_entity_access(ba.entity_id)
    )
  );

-- ============================================
-- 4. VALIDATION TRIGGER: prevent global scope for non-admin roles
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_user_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Only admin and management may have NULL entity_id AND NULL entity_group_id (global access)
  IF NEW.entity_id IS NULL AND NEW.entity_group_id IS NULL THEN
    IF NEW.role NOT IN ('admin', 'management') THEN
      RAISE EXCEPTION 'Role "%" cannot be assigned global access. An entity_id or entity_group_id is required.', NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_role_scope ON public.user_roles;
CREATE TRIGGER trg_validate_user_role_scope
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_role_scope();

-- ============================================
-- 5. Tighten fuel_transactions entity_id
-- ============================================
-- First set any NULL entity_id to a default (shouldn't exist but safety)
UPDATE public.fuel_transactions SET entity_id = (SELECT id FROM public.entities LIMIT 1) WHERE entity_id IS NULL;

-- Make NOT NULL (if currently nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fuel_transactions' AND column_name = 'entity_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.fuel_transactions ALTER COLUMN entity_id SET NOT NULL;
  END IF;
END $$;
