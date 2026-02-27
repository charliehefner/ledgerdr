
-- Add DEP journal sequence
CREATE SEQUENCE IF NOT EXISTS journal_seq_dep START WITH 1;

-- Update trigger to handle DEP prefix
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
    WHEN 'DEP' THEN SELECT nextval('journal_seq_dep') INTO seq_num;
    ELSE SELECT nextval('journals_journal_number_seq') INTO seq_num;
  END CASE;
  NEW.journal_number := prefix || '-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$function$;
