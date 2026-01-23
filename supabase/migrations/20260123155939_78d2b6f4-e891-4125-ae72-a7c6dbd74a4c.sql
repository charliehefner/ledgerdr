-- Create payroll periods table
CREATE TABLE public.payroll_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(start_date, end_date)
);

-- Create employee timesheets for daily entries
CREATE TABLE public.employee_timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours_worked NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN start_time IS NOT NULL AND end_time IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
      ELSE 0
    END
  ) STORED,
  is_absent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

-- Create recurring employee benefits (defaults from profile)
CREATE TABLE public.employee_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, benefit_type)
);

-- Create period-specific benefit overrides
CREATE TABLE public.period_employee_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id, benefit_type)
);

-- Enable RLS
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_employee_benefits ENABLE ROW LEVEL SECURITY;

-- RLS policies for payroll_periods
CREATE POLICY "Admins have full access to periods" ON public.payroll_periods
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view periods" ON public.payroll_periods
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for employee_timesheets
CREATE POLICY "Admins have full access to timesheets" ON public.employee_timesheets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view timesheets" ON public.employee_timesheets
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert timesheets" ON public.employee_timesheets
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update timesheets" ON public.employee_timesheets
  FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for employee_benefits
CREATE POLICY "Admins have full access to benefits" ON public.employee_benefits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view benefits" ON public.employee_benefits
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for period_employee_benefits
CREATE POLICY "Admins have full access to period benefits" ON public.period_employee_benefits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view period benefits" ON public.period_employee_benefits
  FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert period benefits" ON public.period_employee_benefits
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update period benefits" ON public.period_employee_benefits
  FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_timesheets_updated_at
  BEFORE UPDATE ON public.employee_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_benefits_updated_at
  BEFORE UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();