
-- 1. transaction_attachments: drop the 4 blanket USING(true) policies
DROP POLICY IF EXISTS "authenticated_select_transaction_attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "authenticated_insert_transaction_attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "authenticated_update_transaction_attachments" ON public.transaction_attachments;
DROP POLICY IF EXISTS "authenticated_delete_transaction_attachments" ON public.transaction_attachments;

-- 2. contact_bank_accounts: drop the USING(true) SELECT, keep the role-restricted one
DROP POLICY IF EXISTS "Authenticated users can read contact bank accounts" ON public.contact_bank_accounts;

-- 3. service_entry_payments: replace USING(true) SELECT with role-scoped
DROP POLICY IF EXISTS "Authenticated users can view service entry payments" ON public.service_entry_payments;
CREATE POLICY "Authorized roles can view service entry payments"
  ON public.service_entry_payments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'management'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  );

-- 4. vendor_account_rules: replace USING(true) read with role-scoped
DROP POLICY IF EXISTS "vendor_rules_read" ON public.vendor_account_rules;
CREATE POLICY "vendor_rules_read"
  ON public.vendor_account_rules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'management'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  );

-- 5. payment_method_accounts: replace USING(true) read with role-scoped
DROP POLICY IF EXISTS "Authenticated users can read payment_method_accounts" ON public.payment_method_accounts;
CREATE POLICY "Authorized roles can read payment_method_accounts"
  ON public.payment_method_accounts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'management'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  );

-- 6. payroll_snapshots: add entity-scoped mgmt SELECT policy
CREATE POLICY "entity_mgmt_payroll_snapshots"
  ON public.payroll_snapshots FOR SELECT TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::public.app_role, entity_id));
