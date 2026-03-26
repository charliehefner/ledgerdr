
-- Remove validate_journal_balance trigger from journal_lines (it references NEW.posted which doesn't exist on journal_lines)
DROP TRIGGER IF EXISTS trg_validate_balance ON journal_lines;

-- Ensure it exists correctly on journals table
DROP TRIGGER IF EXISTS trg_validate_balance ON journals;
CREATE TRIGGER trg_validate_balance
  BEFORE UPDATE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_balance();
