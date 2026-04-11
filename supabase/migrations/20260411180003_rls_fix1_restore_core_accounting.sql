-- RLS Fix 1: Restore missing policies for budget_lines, bank_accounts, and contacts.
-- These tables had their policies dropped in migration 20260405123942 without replacements.
-- All three tables have entity_id columns.  Policies follow the entity-scoped pattern
-- already used for approval_policies and industrial tables: SELECT via user_has_entity_access,
-- DML via has_role_for_entity per role.

-- ============================================================
-- budget_lines
-- ============================================================

-- Old names: budget_lines_select/insert/update/delete — all dropped in 20260405123942.
-- No replacement was written.

CREATE POLICY "entity_select_budget_lines" ON public.budget_lines FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_budget_lines" ON public.budget_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_budget_lines" ON public.budget_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

-- Accountants can insert and update budget lines but not delete them.
CREATE POLICY "entity_accountant_budget_lines_ins" ON public.budget_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_accountant_budget_lines_upd" ON public.budget_lines FOR UPDATE TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- bank_accounts
-- ============================================================

-- Old names: "Admins full access bank_accounts", "Accountants full access bank_accounts",
-- "Management full access bank_accounts", "Viewers read bank_accounts" — all dropped.

CREATE POLICY "entity_select_bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_bank_accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- ============================================================
-- contacts
-- ============================================================

-- Old names: "Authenticated users can read contacts", "Admin/Management/Accountant can insert",
-- "Admin/Management/Accountant can update", "Admin/Management can delete" — all dropped.

CREATE POLICY "entity_select_contacts" ON public.contacts FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

-- Accountants can insert and update contacts but not delete them.
CREATE POLICY "entity_accountant_contacts_ins" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_accountant_contacts_upd" ON public.contacts FOR UPDATE TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));
