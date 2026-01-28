-- Create employee_loans table for tracking employee loans
CREATE TABLE public.employee_loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_date DATE NOT NULL,
  loan_amount NUMERIC(12,2) NOT NULL,
  number_of_payments INTEGER NOT NULL CHECK (number_of_payments > 0),
  remaining_payments INTEGER NOT NULL CHECK (remaining_payments >= 0),
  payment_amount NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment explaining the table
COMMENT ON TABLE public.employee_loans IS 'Tracks employee loans with automatic payroll deductions';
COMMENT ON COLUMN public.employee_loans.payment_amount IS 'Per-period payment amount (loan_amount / number_of_payments)';
COMMENT ON COLUMN public.employee_loans.remaining_payments IS 'Decremented each payroll period until 0';

-- Enable Row Level Security
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view employee loans"
ON public.employee_loans
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert employee loans"
ON public.employee_loans
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update employee loans"
ON public.employee_loans
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete employee loans"
ON public.employee_loans
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_loans_updated_at
BEFORE UPDATE ON public.employee_loans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();