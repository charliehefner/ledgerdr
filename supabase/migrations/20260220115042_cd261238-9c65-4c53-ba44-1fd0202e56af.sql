
-- Step 1: Add a new UUID column with FK to transactions
ALTER TABLE public.transaction_attachments
  ADD COLUMN transaction_uuid UUID REFERENCES public.transactions(id) ON DELETE CASCADE;

-- Step 2: Backfill from legacy_id join
UPDATE public.transaction_attachments ta
SET transaction_uuid = t.id
FROM public.transactions t
WHERE t.legacy_id::text = ta.transaction_id;

-- Step 3: For any orphaned rows (legacy_id no longer exists), log them but don't block
-- We'll make the column NOT NULL only after confirming all rows are backfilled

-- Step 4: Drop old text column and rename new one
-- Only if all rows have been backfilled
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.transaction_attachments
  WHERE transaction_uuid IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE WARNING '% attachment rows have no matching transaction UUID - keeping old column', orphan_count;
  ELSE
    -- All rows backfilled successfully, safe to swap columns
    ALTER TABLE public.transaction_attachments DROP COLUMN transaction_id;
    ALTER TABLE public.transaction_attachments RENAME COLUMN transaction_uuid TO transaction_id;
    ALTER TABLE public.transaction_attachments ALTER COLUMN transaction_id SET NOT NULL;
    
    -- Re-create the unique constraint for (transaction_id, attachment_category)
    ALTER TABLE public.transaction_attachments
      ADD CONSTRAINT transaction_attachments_txid_category_unique
      UNIQUE (transaction_id, attachment_category);
  END IF;
END $$;
