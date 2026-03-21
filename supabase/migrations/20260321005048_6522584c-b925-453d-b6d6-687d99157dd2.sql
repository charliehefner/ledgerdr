-- Replace existing validate_journal_balance with the new version
CREATE OR REPLACE FUNCTION public.validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  IF NEW.posted = true AND OLD.posted = false THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE journal_id = NEW.id AND deleted_at IS NULL;

    IF round(v_total_debit, 2) <> round(v_total_credit, 2) THEN
      RAISE EXCEPTION 'Journal % is unbalanced: debits=% credits=%',
        NEW.journal_number, v_total_debit, v_total_credit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop old trigger if exists, then create new one
DROP TRIGGER IF EXISTS validate_journal_before_post ON journals;
CREATE TRIGGER validate_journal_before_post
  BEFORE UPDATE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_balance();