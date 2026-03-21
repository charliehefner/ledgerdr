-- Step 1: Allow nulls first on both tables
ALTER TABLE public.transaction_edits
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE public.service_contract_payments
  ALTER COLUMN transaction_id DROP NOT NULL;

-- Step 2: Map legacy integer IDs to UUIDs in transaction_edits
UPDATE transaction_edits te
SET transaction_id = t.id::text
FROM transactions t
WHERE te.transaction_id !~ '^[0-9a-f]{8}-'
  AND t.legacy_id::text = te.transaction_id;

UPDATE transaction_edits
SET transaction_id = NULL
WHERE transaction_id IS NOT NULL
  AND transaction_id !~ '^[0-9a-f]{8}-';

-- Step 3: Map text values in service_contract_payments
UPDATE service_contract_payments scp
SET transaction_id = t.id::text
FROM transactions t
WHERE scp.transaction_id IS NOT NULL
  AND scp.transaction_id !~ '^[0-9a-f]{8}-'
  AND t.legacy_id::text = scp.transaction_id;

UPDATE service_contract_payments
SET transaction_id = NULL
WHERE transaction_id IS NOT NULL
  AND transaction_id !~ '^[0-9a-f]{8}-';

-- Step 4: Convert columns to UUID and add FK constraints
ALTER TABLE public.transaction_edits
  ALTER COLUMN transaction_id TYPE uuid USING transaction_id::uuid;

ALTER TABLE public.transaction_edits
  ADD CONSTRAINT transaction_edits_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.service_contract_payments
  ALTER COLUMN transaction_id TYPE uuid USING transaction_id::uuid;

ALTER TABLE public.service_contract_payments
  ADD CONSTRAINT service_contract_payments_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;