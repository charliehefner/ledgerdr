-- =============================================================================
-- FULL DOUBLE-ENTRY ACCOUNTING SCHEMA (DOMINICAN REPUBLIC)
-- Corrected version with all review fixes applied
-- =============================================================================

-- FIX #7: Removed uuid-ossp extension dependency, using gen_random_uuid() throughout
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- already available in Supabase

-- FIX #2: Sequence MUST exist before the trigger that references it
CREATE SEQUENCE IF NOT EXISTS journals_journal_number_seq;

-- =============================================================================
-- CORE MASTER TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounting_periods (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name      text NOT NULL,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  is_closed        boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz DEFAULT now(),  -- FIX #10: default to now() for consistency
  deleted_at       timestamptz,
  CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code     varchar(20) UNIQUE NOT NULL,
  account_name     text NOT NULL,
  account_type     text CHECK (account_type IN
                   ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')) NOT NULL,
  parent_id        uuid REFERENCES chart_of_accounts(id),
  allow_posting    boolean DEFAULT true,
  currency         varchar(3) DEFAULT 'DOP',
  base_currency    varchar(3) DEFAULT 'DOP',
  created_at       timestamptz DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE TABLE IF NOT EXISTS tax_codes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dgii_code        varchar(10) UNIQUE NOT NULL,
  description      text,
  rate             numeric(6,4) CHECK (rate BETWEEN 0 AND 1),
  affects_itbis    boolean DEFAULT false,
  affects_isr      boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

-- =============================================================================
-- JOURNAL STRUCTURE
-- =============================================================================

CREATE TABLE IF NOT EXISTS journals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number     text UNIQUE,
  -- FIX #5: Add FK to transactions table
  transaction_source_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  journal_date       date NOT NULL,
  description        text,
  currency           varchar(3) DEFAULT 'DOP',
  exchange_rate      numeric(14,6) DEFAULT 1 CHECK (exchange_rate > 0),
  posted             boolean DEFAULT false,
  reversal_of_id     uuid REFERENCES journals(id),
  -- FIX #8: Add period_id FK to enforce period requirement
  period_id          uuid REFERENCES accounting_periods(id),
  created_at         timestamptz DEFAULT now(),
  created_by         uuid,
  posted_by          uuid,
  posted_at          timestamptz,
  updated_at         timestamptz DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id       uuid REFERENCES journals(id) ON DELETE CASCADE,
  account_id       uuid REFERENCES chart_of_accounts(id) NOT NULL,
  debit            numeric(18,2) DEFAULT 0,
  credit           numeric(18,2) DEFAULT 0,
  tax_code_id      uuid REFERENCES tax_codes(id),
  project_code     text,
  cbs_code         text,
  created_at       timestamptz DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

-- =============================================================================
-- CONSTRAINTS
-- =============================================================================

ALTER TABLE journal_lines
  ADD CONSTRAINT chk_debit_credit_one_sided CHECK (
    (debit > 0 AND credit = 0) OR
    (credit > 0 AND debit = 0) OR
    (debit = 0 AND credit = 0)
  );

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_journals_date ON journals(journal_date);
CREATE INDEX idx_journals_posted ON journals(posted);
CREATE INDEX idx_journals_transaction_id ON journals(transaction_source_id);
CREATE INDEX idx_journals_period_id ON journals(period_id);
CREATE INDEX idx_journal_lines_journal ON journal_lines(journal_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_tax_code ON journal_lines(tax_code_id);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);

-- =============================================================================
-- TRIGGERS & FUNCTIONS
-- =============================================================================

-- 1. Prevent overlapping periods
-- FIX #3: Changed tsrange to daterange for date columns
CREATE OR REPLACE FUNCTION check_period_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE id != NEW.id
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Accounting period overlaps with an existing period';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_period_overlap
  BEFORE INSERT OR UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION check_period_overlap();

-- 2. Prevent posting to non-postable accounts
CREATE OR REPLACE FUNCTION validate_postable_account()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chart_of_accounts
    WHERE id = NEW.account_id
      AND allow_posting = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot post to non-postable account: %', NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_postable_account
  BEFORE INSERT OR UPDATE OF account_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION validate_postable_account();

-- 3. Validate journal is balanced (deferred)
-- FIX #6: Keep deferred constraint trigger but also validate in post_journal()
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS trigger AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines
  WHERE journal_id = NEW.journal_id AND deleted_at IS NULL;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal not balanced: debit = %, credit = %',
      total_debit, total_credit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_validate_balance
  AFTER INSERT OR UPDATE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

-- 4. Prevent posting in closed periods
-- FIX #8: Also require that a matching OPEN period exists
CREATE OR REPLACE FUNCTION prevent_posting_closed_period()
RETURNS trigger AS $$
BEGIN
  -- Block if a closed period covers this date
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND is_closed = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot modify journal in a closed accounting period';
  END IF;

  -- Also require at least one open period exists for this date
  IF NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE NEW.journal_date BETWEEN start_date AND end_date
      AND is_closed = false
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No open accounting period exists for date %', NEW.journal_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_closed_period
  BEFORE INSERT OR UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION prevent_posting_closed_period();

-- 5. Prevent edits to posted journals/lines
-- FIX #4: Split into two separate functions for journals vs journal_lines

-- 5a. For the journals table itself
CREATE OR REPLACE FUNCTION prevent_edit_posted_journal()
RETURNS trigger AS $$
BEGIN
  IF OLD.posted = true AND OLD.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Posted journals cannot be modified or deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_edit_posted_journal
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW WHEN (OLD.posted = true)
  EXECUTE FUNCTION prevent_edit_posted_journal();

-- 5b. For journal_lines (looks up parent journal)
CREATE OR REPLACE FUNCTION prevent_edit_posted_journal_line()
RETURNS trigger AS $$
DECLARE
  v_journal_id uuid;
BEGIN
  -- On DELETE, NEW is NULL, so use OLD
  v_journal_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.journal_id END,
    OLD.journal_id
  );

  IF EXISTS (
    SELECT 1 FROM journals
    WHERE id = v_journal_id
      AND posted = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Lines of posted journals cannot be modified or deleted';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_edit_posted_lines
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_edit_posted_journal_line();

-- 6. Auto-update timestamp
CREATE OR REPLACE FUNCTION update_accounting_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_journals
  BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

CREATE TRIGGER trg_update_journal_lines
  BEFORE UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

CREATE TRIGGER trg_update_coa
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

CREATE TRIGGER trg_update_tax_codes
  BEFORE UPDATE ON tax_codes
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

CREATE TRIGGER trg_update_periods
  BEFORE UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION update_accounting_timestamp();

-- 7. Generate prefixed journal_number (e.g., 'GJ-000001')
CREATE OR REPLACE FUNCTION generate_journal_number()
RETURNS trigger AS $$
DECLARE
  seq_num bigint;
BEGIN
  SELECT nextval('journals_journal_number_seq') INTO seq_num;
  NEW.journal_number = 'GJ-' || LPAD(seq_num::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_journal_number
  BEFORE INSERT ON journals
  FOR EACH ROW EXECUTE FUNCTION generate_journal_number();

-- =============================================================================
-- POSTING FUNCTION (with approval)
-- =============================================================================

CREATE OR REPLACE FUNCTION post_journal(p_journal_id uuid, p_user uuid)
RETURNS void AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE journal_id = p_journal_id AND deleted_at IS NULL;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Cannot post unbalanced journal';
  END IF;

  UPDATE journals
  SET posted    = true,
      posted_by = p_user,
      posted_at = now()
  WHERE id = p_journal_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REVERSAL FUNCTION (auto-generates opposite journal)
-- =============================================================================

CREATE OR REPLACE FUNCTION create_reversal_journal(
  p_original_journal_id uuid,
  p_reversal_date date,
  p_description text,
  p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
  new_journal_id uuid;
  orig_currency varchar(3);
  orig_exchange_rate numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM journals
    WHERE id = p_original_journal_id AND posted = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Can only reverse posted journals';
  END IF;

  SELECT currency, exchange_rate INTO orig_currency, orig_exchange_rate
  FROM journals WHERE id = p_original_journal_id;

  INSERT INTO journals (
    journal_date, description, currency, exchange_rate, posted,
    reversal_of_id, created_by
  )
  VALUES (
    p_reversal_date, p_description, orig_currency, orig_exchange_rate,
    false, p_original_journal_id, p_created_by
  )
  RETURNING id INTO new_journal_id;

  INSERT INTO journal_lines (
    journal_id, account_id, debit, credit, tax_code_id, project_code,
    cbs_code, created_by
  )
  SELECT
    new_journal_id, account_id, credit, debit, tax_code_id, project_code,
    cbs_code, p_created_by
  FROM journal_lines
  WHERE journal_id = p_original_journal_id AND deleted_at IS NULL;

  RETURN new_journal_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- HELPER: Create journal stub from single-entry transaction
-- =============================================================================

CREATE OR REPLACE FUNCTION create_journal_from_transaction(
  p_transaction_id uuid,
  p_date date,
  p_description text,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_journal uuid;
BEGIN
  INSERT INTO journals (
    transaction_source_id, journal_date, description, posted, created_by
  )
  VALUES (p_transaction_id, p_date, p_description, false, p_created_by)
  RETURNING id INTO new_journal;

  RETURN new_journal;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REPORTING VIEWS / FUNCTIONS
-- =============================================================================

-- FIX #12: Trial Balance as parameterized function instead of view
CREATE OR REPLACE FUNCTION trial_balance(p_start date DEFAULT NULL, p_end date DEFAULT NULL)
RETURNS TABLE (
  account_code  varchar,
  account_name  text,
  account_type  text,
  total_debit_base  numeric,
  total_credit_base numeric,
  balance_base      numeric
) AS $$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(l.debit * j.exchange_rate)  AS total_debit_base,
    SUM(l.credit * j.exchange_rate) AS total_credit_base,
    SUM((l.debit - l.credit) * j.exchange_rate) AS balance_base
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id
  JOIN journals j ON j.id = l.journal_id AND j.posted = true
  WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
    AND (p_start IS NULL OR j.journal_date >= p_start)
    AND (p_end   IS NULL OR j.journal_date <= p_end)
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_code;
$$ LANGUAGE sql;

-- Keep the view for backward compat / Power BI
CREATE OR REPLACE VIEW trial_balance_all AS
SELECT
  a.account_code,
  a.account_name,
  a.account_type,
  SUM(l.debit * j.exchange_rate)  AS total_debit_base,
  SUM(l.credit * j.exchange_rate) AS total_credit_base,
  SUM((l.debit - l.credit) * j.exchange_rate) AS balance_base
FROM journal_lines l
JOIN chart_of_accounts a ON a.id = l.account_id
JOIN journals j ON j.id = l.journal_id AND j.posted = true
WHERE l.deleted_at IS NULL AND j.deleted_at IS NULL AND a.deleted_at IS NULL
GROUP BY a.account_code, a.account_name, a.account_type
ORDER BY a.account_code;

-- General Ledger view
CREATE OR REPLACE VIEW general_ledger AS
SELECT
  j.journal_date,
  j.journal_number,
  a.account_code,
  a.account_name,
  j.description,
  l.debit,
  l.credit,
  l.debit  * j.exchange_rate AS debit_base,
  l.credit * j.exchange_rate AS credit_base,
  SUM((l.debit - l.credit) * j.exchange_rate) OVER (
    PARTITION BY a.account_code
    ORDER BY j.journal_date, j.journal_number, l.id
  ) AS running_balance_base
FROM journal_lines l
JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
WHERE l.deleted_at IS NULL
ORDER BY a.account_code, j.journal_date, j.journal_number;

-- FIX #9: Income Statement – summary version (original)
CREATE OR REPLACE FUNCTION income_statement(p_start date, p_end date)
RETURNS TABLE (
  account_type    text,
  total_income    numeric,
  total_expense   numeric,
  net_result      numeric
) AS $$
  SELECT
    a.account_type,
    SUM(CASE WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * j.exchange_rate ELSE 0 END) AS total_income,
    SUM(CASE WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * j.exchange_rate ELSE 0 END) AS total_expense,
    SUM(CASE WHEN a.account_type IN ('INCOME','EXPENSE') THEN (l.credit - l.debit) * j.exchange_rate ELSE 0 END) AS net_result
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_type;
$$ LANGUAGE sql;

-- FIX #9: Income Statement – detailed version (account-level drill-down)
CREATE OR REPLACE FUNCTION income_statement_detail(p_start date, p_end date)
RETURNS TABLE (
  account_code    varchar,
  account_name    text,
  account_type    text,
  total_amount    numeric
) AS $$
  SELECT
    a.account_code,
    a.account_name,
    a.account_type,
    SUM(
      CASE
        WHEN a.account_type = 'INCOME'  THEN (l.credit - l.debit) * j.exchange_rate
        WHEN a.account_type = 'EXPENSE' THEN (l.debit - l.credit) * j.exchange_rate
        ELSE 0
      END
    ) AS total_amount
  FROM journal_lines l
  JOIN chart_of_accounts a ON a.id = l.account_id AND a.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.posted = true AND j.deleted_at IS NULL
  WHERE j.journal_date BETWEEN p_start AND p_end
    AND a.account_type IN ('INCOME','EXPENSE')
    AND l.deleted_at IS NULL
  GROUP BY a.account_code, a.account_name, a.account_type
  ORDER BY a.account_type, a.account_code;
$$ LANGUAGE sql;

-- DGII 507 – ISR Retentions
CREATE OR REPLACE FUNCTION dgii_507_report(p_start date, p_end date)
RETURNS TABLE (
  journal_date    date,
  transaction_id  uuid,
  dgii_code       varchar,
  retained_amount numeric
) AS $$
  SELECT
    j.journal_date,
    j.transaction_source_id,
    t.dgii_code,
    l.credit * j.exchange_rate AS retained_amount_base
  FROM journal_lines l
  JOIN tax_codes t ON t.id = l.tax_code_id AND t.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.deleted_at IS NULL
  WHERE t.affects_isr = true
    AND j.posted = true
    AND j.journal_date BETWEEN p_start AND p_end
    AND l.deleted_at IS NULL;
$$ LANGUAGE sql;

-- DGII 509 – ITBIS Withholding
CREATE OR REPLACE FUNCTION dgii_509_report(p_start date, p_end date)
RETURNS TABLE (
  journal_date    date,
  transaction_id  uuid,
  dgii_code       varchar,
  itbis_withheld  numeric
) AS $$
  SELECT
    j.journal_date,
    j.transaction_source_id,
    t.dgii_code,
    l.credit * j.exchange_rate AS itbis_withheld_base
  FROM journal_lines l
  JOIN tax_codes t ON t.id = l.tax_code_id AND t.deleted_at IS NULL
  JOIN journals j ON j.id = l.journal_id AND j.deleted_at IS NULL
  WHERE t.affects_itbis = true
    AND j.posted = true
    AND j.journal_date BETWEEN p_start AND p_end
    AND l.deleted_at IS NULL;
$$ LANGUAGE sql;

-- =============================================================================
-- FIX #11: AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  action        text NOT NULL,        -- INSERT, UPDATE, DELETE, SOFT_DELETE, POST, REVERSE
  table_name    text NOT NULL,
  record_id     uuid,
  old_values    jsonb,
  new_values    jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON accounting_audit_log(table_name);
CREATE INDEX idx_audit_log_record ON accounting_audit_log(record_id);
CREATE INDEX idx_audit_log_user ON accounting_audit_log(user_id);
CREATE INDEX idx_audit_log_created ON accounting_audit_log(created_at);

-- =============================================================================
-- ROW LEVEL SECURITY
-- FIX #1: Using your app's has_role() pattern with app_role enum
-- =============================================================================

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

-- ---- JOURNALS ----

CREATE POLICY "Admins have full access to journals"
  ON journals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to journals"
  ON journals FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view journals"
  ON journals FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Accountants can insert journals"
  ON journals FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update journals"
  ON journals FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Supervisors can view journals"
  ON journals FOR SELECT
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Viewers can view journals"
  ON journals FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role) AND deleted_at IS NULL);

-- ---- JOURNAL LINES ----

CREATE POLICY "Admins have full access to journal lines"
  ON journal_lines FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to journal lines"
  ON journal_lines FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view journal lines"
  ON journal_lines FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Accountants can insert journal lines"
  ON journal_lines FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update journal lines"
  ON journal_lines FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Supervisors can view journal lines"
  ON journal_lines FOR SELECT
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Viewers can view journal lines"
  ON journal_lines FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role) AND deleted_at IS NULL);

-- ---- CHART OF ACCOUNTS ----

CREATE POLICY "Admins have full access to chart of accounts"
  ON chart_of_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to chart of accounts"
  ON chart_of_accounts FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view chart of accounts"
  ON chart_of_accounts FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Accountants can insert chart of accounts"
  ON chart_of_accounts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update chart of accounts"
  ON chart_of_accounts FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Supervisors can view chart of accounts"
  ON chart_of_accounts FOR SELECT
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Viewers can view chart of accounts"
  ON chart_of_accounts FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role) AND deleted_at IS NULL);

-- ---- ACCOUNTING PERIODS ----

CREATE POLICY "Admins have full access to accounting periods"
  ON accounting_periods FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to accounting periods"
  ON accounting_periods FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view accounting periods"
  ON accounting_periods FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Accountants can insert accounting periods"
  ON accounting_periods FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update accounting periods"
  ON accounting_periods FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Supervisors can view accounting periods"
  ON accounting_periods FOR SELECT
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Viewers can view accounting periods"
  ON accounting_periods FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role) AND deleted_at IS NULL);

-- ---- TAX CODES ----

CREATE POLICY "Admins have full access to tax codes"
  ON tax_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management has full access to tax codes"
  ON tax_codes FOR ALL
  USING (has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view tax codes"
  ON tax_codes FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Accountants can insert tax codes"
  ON tax_codes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can update tax codes"
  ON tax_codes FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Supervisors can view tax codes"
  ON tax_codes FOR SELECT
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Viewers can view tax codes"
  ON tax_codes FOR SELECT
  USING (has_role(auth.uid(), 'viewer'::app_role) AND deleted_at IS NULL);

-- ---- AUDIT LOG ----

CREATE POLICY "Admins have full access to audit log"
  ON accounting_audit_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Management can view audit log"
  ON accounting_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Accountants can view audit log"
  ON accounting_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Accountants can insert audit log"
  ON accounting_audit_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

-- =============================================================================
-- END OF CORRECTED SCHEMA
-- =============================================================================
