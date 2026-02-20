
-- Step 1: Add nullable UUID FK columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS cbs_id uuid REFERENCES public.cbs_codes(id);

-- Step 2: Backfill account_id from master_acct_code
UPDATE public.transactions t
SET account_id = c.id
FROM public.chart_of_accounts c
WHERE t.master_acct_code = c.account_code
  AND t.account_id IS NULL;

-- Step 3: Backfill project_id from project_code
UPDATE public.transactions t
SET project_id = p.id
FROM public.projects p
WHERE t.project_code = p.code
  AND t.project_id IS NULL;

-- Step 4: Backfill cbs_id from cbs_code
UPDATE public.transactions t
SET cbs_id = cb.id
FROM public.cbs_codes cb
WHERE t.cbs_code = cb.code
  AND t.cbs_id IS NULL;

-- Step 5: Add indexes for FK lookups
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON public.transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cbs_id ON public.transactions(cbs_id);

-- Step 6: Add comment marking text columns as deprecated
COMMENT ON COLUMN public.transactions.master_acct_code IS 'DEPRECATED: Use account_id FK instead';
COMMENT ON COLUMN public.transactions.project_code IS 'DEPRECATED: Use project_id FK instead';
COMMENT ON COLUMN public.transactions.cbs_code IS 'DEPRECATED: Use cbs_id FK instead';
