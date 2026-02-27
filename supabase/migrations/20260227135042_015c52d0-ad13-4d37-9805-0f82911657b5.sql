
-- 1. Add journal_type column
ALTER TABLE journals ADD COLUMN journal_type varchar(3) NOT NULL DEFAULT 'GJ';

-- 2. Create per-type sequences
CREATE SEQUENCE journal_seq_pj START 1;
CREATE SEQUENCE journal_seq_sj START 1;
CREATE SEQUENCE journal_seq_prj START 1;
CREATE SEQUENCE journal_seq_cdj START 1;
CREATE SEQUENCE journal_seq_crj START 1;

-- 3. Replace generate_journal_number() trigger function
CREATE OR REPLACE FUNCTION public.generate_journal_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  seq_num bigint;
  prefix text;
BEGIN
  prefix := COALESCE(NEW.journal_type, 'GJ');
  CASE prefix
    WHEN 'PJ'  THEN SELECT nextval('journal_seq_pj') INTO seq_num;
    WHEN 'SJ'  THEN SELECT nextval('journal_seq_sj') INTO seq_num;
    WHEN 'PRJ' THEN SELECT nextval('journal_seq_prj') INTO seq_num;
    WHEN 'CDJ' THEN SELECT nextval('journal_seq_cdj') INTO seq_num;
    WHEN 'CRJ' THEN SELECT nextval('journal_seq_crj') INTO seq_num;
    ELSE SELECT nextval('journals_journal_number_seq') INTO seq_num;
  END CASE;
  NEW.journal_number := prefix || '-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$function$;

-- 4. Update create_journal_from_transaction RPC to accept journal_type
CREATE OR REPLACE FUNCTION public.create_journal_from_transaction(
  p_transaction_id uuid,
  p_date date,
  p_description text,
  p_created_by uuid DEFAULT NULL::uuid,
  p_journal_type varchar DEFAULT 'GJ'
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  new_journal uuid;
BEGIN
  INSERT INTO journals (
    transaction_source_id, journal_date, description, posted, created_by, journal_type
  )
  VALUES (p_transaction_id, p_date, p_description, false, p_created_by, p_journal_type)
  RETURNING id INTO new_journal;

  RETURN new_journal;
END;
$function$;

-- 5. Backfill existing journals linked to transactions as PJ
UPDATE journals SET journal_type = 'PJ' WHERE transaction_source_id IS NOT NULL AND deleted_at IS NULL;
