-- Create payments table for service contracts
CREATE TABLE public.service_contract_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_contract_payments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage payments (same as contracts)
CREATE POLICY "Authenticated users can view payments"
ON public.service_contract_payments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert payments"
ON public.service_contract_payments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
ON public.service_contract_payments
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete payments"
ON public.service_contract_payments
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_service_contract_payments_contract_id ON public.service_contract_payments(contract_id);
CREATE INDEX idx_service_contract_payments_date ON public.service_contract_payments(payment_date);