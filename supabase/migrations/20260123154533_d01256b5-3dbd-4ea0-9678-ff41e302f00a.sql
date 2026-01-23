-- Create employees table with core information
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  bank TEXT,
  bank_account_number TEXT,
  date_of_birth DATE,
  date_of_hire DATE NOT NULL,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  boot_size TEXT,
  pant_size TEXT,
  shirt_size TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create salary history to track changes
CREATE TABLE public.employee_salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary NUMERIC(12,2) NOT NULL,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vacations table for tracking vacation periods
CREATE TABLE public.employee_vacations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table for tracking employee incidents
CREATE TABLE public.employee_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table for employee document repository
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins have full access to employees" ON public.employees FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view employees" ON public.employees FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS Policies for salary history (admin only due to sensitivity)
CREATE POLICY "Admins have full access to salary history" ON public.employee_salary_history FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for vacations
CREATE POLICY "Admins have full access to vacations" ON public.employee_vacations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view vacations" ON public.employee_vacations FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- RLS Policies for incidents (admin only)
CREATE POLICY "Admins have full access to incidents" ON public.employee_incidents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for documents
CREATE POLICY "Admins have full access to documents" ON public.employee_documents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view documents" ON public.employee_documents FOR SELECT USING (has_role(auth.uid(), 'accountant'::app_role));

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

-- Storage policies for employee documents bucket
CREATE POLICY "Admins can manage employee documents" ON storage.objects FOR ALL USING (bucket_id = 'employee-documents' AND has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (bucket_id = 'employee-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view employee documents" ON storage.objects FOR SELECT USING (bucket_id = 'employee-documents' AND has_role(auth.uid(), 'accountant'::app_role));

-- Trigger for updating timestamps
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();