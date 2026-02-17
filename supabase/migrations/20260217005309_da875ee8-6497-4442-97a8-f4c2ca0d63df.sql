
-- 1. accounting_periods
DROP TRIGGER IF EXISTS trg_check_period_overlap ON accounting_periods;
CREATE TRIGGER trg_check_period_overlap
  BEFORE INSERT OR UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION check_period_overlap();

DROP TRIGGER IF EXISTS trg_update_periods ON accounting_periods;
CREATE TRIGGER trg_update_periods
  BEFORE UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

-- 2. journal_lines
DROP TRIGGER IF EXISTS trg_validate_postable_account ON journal_lines;
CREATE TRIGGER trg_validate_postable_account
  BEFORE INSERT OR UPDATE OF account_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION validate_postable_account();

DROP TRIGGER IF EXISTS trg_validate_balance ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_validate_balance
  AFTER INSERT OR UPDATE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

DROP TRIGGER IF EXISTS trg_no_edit_posted_lines ON journal_lines;
CREATE TRIGGER trg_no_edit_posted_lines
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_edit_posted_journal_line();

DROP TRIGGER IF EXISTS trg_update_journal_lines ON journal_lines;
CREATE TRIGGER trg_update_journal_lines
  BEFORE UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

-- 3. journals
DROP TRIGGER IF EXISTS trg_prevent_closed_period ON journals;
CREATE TRIGGER trg_prevent_closed_period
  BEFORE INSERT OR UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION prevent_posting_closed_period();

DROP TRIGGER IF EXISTS trg_no_edit_posted_journal ON journals;
CREATE TRIGGER trg_no_edit_posted_journal
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW
  WHEN (OLD.posted = true)
  EXECUTE FUNCTION prevent_edit_posted_journal();

DROP TRIGGER IF EXISTS trg_update_journals ON journals;
CREATE TRIGGER trg_update_journals
  BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

DROP TRIGGER IF EXISTS trg_generate_journal_number ON journals;
CREATE TRIGGER trg_generate_journal_number
  BEFORE INSERT ON journals
  FOR EACH ROW EXECUTE FUNCTION generate_journal_number();

-- 4. chart_of_accounts
DROP TRIGGER IF EXISTS trg_update_coa ON chart_of_accounts;
CREATE TRIGGER trg_update_coa
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

-- 5. tax_codes
DROP TRIGGER IF EXISTS trg_update_tax_codes ON tax_codes;
CREATE TRIGGER trg_update_tax_codes
  BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();
