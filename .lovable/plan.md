

# Apply Missing Trigger Bindings for Accounting Schema

The tables and functions were created successfully, but the `CREATE TRIGGER` statements did not execute. I will run a single migration with all 13 trigger statements.

## Triggers to Create

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| trg_check_period_overlap | accounting_periods | BEFORE INSERT OR UPDATE | check_period_overlap() |
| trg_validate_postable_account | journal_lines | BEFORE INSERT OR UPDATE OF account_id | validate_postable_account() |
| trg_validate_balance | journal_lines | AFTER INSERT OR UPDATE (DEFERRABLE) | validate_journal_balance() |
| trg_prevent_closed_period | journals | BEFORE INSERT OR UPDATE | prevent_posting_closed_period() |
| trg_no_edit_posted_journal | journals | BEFORE UPDATE OR DELETE (WHEN posted=true) | prevent_edit_posted_journal() |
| trg_no_edit_posted_lines | journal_lines | BEFORE UPDATE OR DELETE | prevent_edit_posted_journal_line() |
| trg_update_journals | journals | BEFORE UPDATE | update_accounting_timestamp() |
| trg_update_journal_lines | journal_lines | BEFORE UPDATE | update_accounting_timestamp() |
| trg_update_coa | chart_of_accounts | BEFORE UPDATE | update_accounting_timestamp() |
| trg_update_tax_codes | tax_codes | BEFORE UPDATE | update_accounting_timestamp() |
| trg_update_periods | accounting_periods | BEFORE UPDATE | update_accounting_timestamp() |
| trg_generate_journal_number | journals | BEFORE INSERT | generate_journal_number() |

## Technical Details

A single SQL migration using `CREATE TRIGGER IF NOT EXISTS` (via `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` pairs for safety) will bind all 12 triggers to their respective tables. This is a non-destructive operation -- no data is modified, only trigger bindings are added.

