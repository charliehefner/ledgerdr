-- Add is_internal column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Create index for searching internal transactions
CREATE INDEX idx_transactions_is_internal ON public.transactions(is_internal) WHERE is_internal = true;