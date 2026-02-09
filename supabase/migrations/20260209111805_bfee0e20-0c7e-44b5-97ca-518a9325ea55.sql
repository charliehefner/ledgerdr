
-- Fix permissive RLS policies on service_contracts family

-- 1. service_contracts
DROP POLICY "Authenticated users can view contracts" ON service_contracts;
DROP POLICY "Authenticated users can insert contracts" ON service_contracts;
DROP POLICY "Authenticated users can update contracts" ON service_contracts;
DROP POLICY "Authenticated users can delete contracts" ON service_contracts;

CREATE POLICY "Admins have full access to service contracts" ON service_contracts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to service contracts" ON service_contracts FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Supervisors have full access to service contracts" ON service_contracts FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Accountants can view service contracts" ON service_contracts FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Viewers can view service contracts" ON service_contracts FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- 2. service_contract_entries
DROP POLICY "Authenticated users can view entries" ON service_contract_entries;
DROP POLICY "Authenticated users can insert entries" ON service_contract_entries;
DROP POLICY "Authenticated users can update entries" ON service_contract_entries;
DROP POLICY "Authenticated users can delete entries" ON service_contract_entries;

CREATE POLICY "Admins have full access to contract entries" ON service_contract_entries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to contract entries" ON service_contract_entries FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Supervisors have full access to contract entries" ON service_contract_entries FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Accountants can view contract entries" ON service_contract_entries FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Viewers can view contract entries" ON service_contract_entries FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- 3. service_contract_line_items
DROP POLICY "Authenticated users can view line items" ON service_contract_line_items;
DROP POLICY "Authenticated users can insert line items" ON service_contract_line_items;
DROP POLICY "Authenticated users can update line items" ON service_contract_line_items;
DROP POLICY "Authenticated users can delete line items" ON service_contract_line_items;

CREATE POLICY "Admins have full access to contract line items" ON service_contract_line_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to contract line items" ON service_contract_line_items FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Supervisors have full access to contract line items" ON service_contract_line_items FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Accountants can view contract line items" ON service_contract_line_items FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Viewers can view contract line items" ON service_contract_line_items FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));

-- 4. service_contract_payments
DROP POLICY "Authenticated users can view payments" ON service_contract_payments;
DROP POLICY "Authenticated users can insert payments" ON service_contract_payments;
DROP POLICY "Authenticated users can update payments" ON service_contract_payments;
DROP POLICY "Authenticated users can delete payments" ON service_contract_payments;

CREATE POLICY "Admins have full access to contract payments" ON service_contract_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to contract payments" ON service_contract_payments FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Supervisors have full access to contract payments" ON service_contract_payments FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Accountants can view contract payments" ON service_contract_payments FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Viewers can view contract payments" ON service_contract_payments FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role));
