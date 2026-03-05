
-- Add destination_amount column to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS destination_amount NUMERIC(15,2);

-- Ensure exchange gain/loss account 8510 exists
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, allow_posting, english_description, spanish_description)
VALUES ('8510', 'Diferencia Cambiaria', 'EXPENSE', true, 'Exchange Rate Gain/Loss', 'Diferencia Cambiaria')
ON CONFLICT (account_code) DO NOTHING;
