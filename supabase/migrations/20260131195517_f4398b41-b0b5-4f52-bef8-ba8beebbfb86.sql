-- =====================================================
-- FIX 1: employee_loans - Replace permissive policies with role-based
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view employee loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Authenticated users can insert employee loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Authenticated users can update employee loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Authenticated users can delete employee loans" ON public.employee_loans;

-- Create proper role-based policies for employee_loans
-- Admin has full access
CREATE POLICY "Admins have full access to employee loans"
ON public.employee_loans
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Management has full access
CREATE POLICY "Management has full access to employee loans"
ON public.employee_loans
FOR ALL
USING (public.has_role(auth.uid(), 'management'))
WITH CHECK (public.has_role(auth.uid(), 'management'));

-- Accountants can view and manage loans (needed for payroll processing)
CREATE POLICY "Accountants can manage employee loans"
ON public.employee_loans
FOR ALL
USING (public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'accountant'));

-- =====================================================
-- FIX 2: day_labor_attachments - Replace generic auth check with role-based
-- =====================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view day labor attachments" ON public.day_labor_attachments;
DROP POLICY IF EXISTS "Authenticated users can insert day labor attachments" ON public.day_labor_attachments;
DROP POLICY IF EXISTS "Authenticated users can update day labor attachments" ON public.day_labor_attachments;
DROP POLICY IF EXISTS "Authenticated users can delete day labor attachments" ON public.day_labor_attachments;

-- Create proper role-based policies for day_labor_attachments
-- Admin has full access
CREATE POLICY "Admins have full access to day labor attachments"
ON public.day_labor_attachments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Management has full access
CREATE POLICY "Management has full access to day labor attachments"
ON public.day_labor_attachments
FOR ALL
USING (public.has_role(auth.uid(), 'management'))
WITH CHECK (public.has_role(auth.uid(), 'management'));

-- Accountants can manage day labor attachments (needed for payroll)
CREATE POLICY "Accountants can manage day labor attachments"
ON public.day_labor_attachments
FOR ALL
USING (public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'accountant'));

-- =====================================================
-- FIX 3: Create a view for employees without sensitive data for accountants
-- =====================================================

-- Create a function to check if current user is accountant (not admin/management)
CREATE OR REPLACE FUNCTION public.is_accountant_only()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(auth.uid(), 'accountant') 
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'management')
$$;

-- Create view for employees without sensitive PII (for accountants)
CREATE OR REPLACE VIEW public.employees_safe 
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  position,
  date_of_hire,
  salary,
  is_active,
  shirt_size,
  pant_size,
  boot_size,
  date_of_birth,
  created_at,
  updated_at,
  -- Mask sensitive fields - only show last 4 digits
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN cedula
    ELSE '***-*******-' || RIGHT(cedula, 1)
  END as cedula,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN bank
    ELSE bank  -- Bank name is not sensitive
  END as bank,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')
    THEN bank_account_number
    ELSE '****' || RIGHT(COALESCE(bank_account_number, ''), 4)
  END as bank_account_number
FROM public.employees;