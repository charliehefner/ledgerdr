ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS manual_credit_account_code TEXT NULL;

COMMENT ON COLUMN public.transactions.manual_credit_account_code IS
  'Optional credit account code set by a posting rule action (credit_account_code). When present, generate-journals uses this instead of the auto-resolved bank/AP/AR account. NULL means standard auto-resolution.';