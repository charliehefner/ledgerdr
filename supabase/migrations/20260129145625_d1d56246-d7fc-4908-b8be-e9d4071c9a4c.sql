-- Add RNC column to transactions table
ALTER TABLE public.transactions
ADD COLUMN rnc text NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.transactions.rnc IS 'Registro Nacional del Contribuyente (Dominican tax ID)';