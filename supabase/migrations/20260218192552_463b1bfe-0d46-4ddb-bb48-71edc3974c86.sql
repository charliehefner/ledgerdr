
-- Create payroll_snapshots table
CREATE TABLE public.payroll_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_pay numeric NOT NULL DEFAULT 0,
  overtime_pay numeric NOT NULL DEFAULT 0,
  holiday_pay numeric NOT NULL DEFAULT 0,
  sunday_pay numeric NOT NULL DEFAULT 0,
  total_benefits numeric NOT NULL DEFAULT 0,
  tss numeric NOT NULL DEFAULT 0,
  isr numeric NOT NULL DEFAULT 0,
  loan_deduction numeric NOT NULL DEFAULT 0,
  absence_deduction numeric NOT NULL DEFAULT 0,
  vacation_deduction numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.payroll_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies mirroring payroll_periods
CREATE POLICY "Admins have full access to payroll snapshots"
  ON public.payroll_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to payroll snapshots"
  ON public.payroll_snapshots FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view payroll snapshots"
  ON public.payroll_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));
