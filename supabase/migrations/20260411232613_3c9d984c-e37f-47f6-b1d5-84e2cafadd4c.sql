-- budget_lines
CREATE POLICY "entity_select_budget_lines" ON public.budget_lines FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_budget_lines" ON public.budget_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_budget_lines" ON public.budget_lines FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_budget_lines_ins" ON public.budget_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_accountant_budget_lines_upd" ON public.budget_lines FOR UPDATE TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

-- bank_accounts
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

-- contacts
CREATE POLICY "entity_select_contacts" ON public.contacts FOR SELECT TO authenticated
  USING (public.user_has_entity_access(entity_id));

CREATE POLICY "entity_admin_contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));

CREATE POLICY "entity_mgmt_contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));

CREATE POLICY "entity_accountant_contacts_ins" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));

CREATE POLICY "entity_accountant_contacts_upd" ON public.contacts FOR UPDATE TO authenticated
  USING (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (public.has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));