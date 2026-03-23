-- Add 'transfer' to allowed transaction types
ALTER TABLE public.fuel_transactions DROP CONSTRAINT fuel_transactions_transaction_type_check;
ALTER TABLE public.fuel_transactions ADD CONSTRAINT fuel_transactions_transaction_type_check 
  CHECK (transaction_type = ANY (ARRAY['refill'::text, 'dispense'::text, 'transfer'::text]));

-- Add destination_tank_id for transfer transactions
ALTER TABLE public.fuel_transactions 
  ADD COLUMN destination_tank_id uuid REFERENCES public.fuel_tanks(id);