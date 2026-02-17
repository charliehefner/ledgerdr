

# Accounting Schema Review: Weak Spots and Missing Logic

## 1. CRITICAL: RLS Policies Don't Match Your App's Pattern

**Problem**: The schema uses simple `auth.uid() IS NOT NULL` and `created_by = auth.uid()` checks. Your entire app uses the `has_role(auth.uid(), 'admin'::app_role)` pattern with your `user_roles` table and `app_role` enum.

**Fix**: Replace all 5 RLS policy blocks (lines 504-526) with your standard role-based pattern:
- Admin/Management: full access (ALL)
- Accountant: INSERT, UPDATE, SELECT (not DELETE)
- Supervisor: SELECT only
- Viewer: SELECT only

The placeholder `'admin-uuid-example'` on line 520 would block all users immediately.

---

## 2. CRITICAL: Missing Sequence Before Trigger

**Problem**: The `generate_journal_number()` trigger (line 268) calls `nextval('journals_journal_number_seq')`, but the `CREATE SEQUENCE` statement is on line 284 -- after the trigger creation. If the trigger fires before the sequence exists, it will fail.

**Fix**: Move `CREATE SEQUENCE IF NOT EXISTS journals_journal_number_seq;` to before the function definition.

---

## 3. HIGH: Period Overlap Check Uses `tsrange` on `date` Columns

**Problem**: Line 153 uses `tsrange(start_date, end_date, '[]')` but `start_date` and `end_date` are `date` type, not `timestamp`. This will cause an implicit cast that may produce unexpected results.

**Fix**: Use `daterange(start_date, end_date, '[]')` instead.

---

## 4. HIGH: `prevent_edit_posted_journal` Trigger Logic Is Fragile

**Problem**: The trigger on `journal_lines` (line 247) looks up the journal by `COALESCE(NEW.journal_id, OLD.journal_id, NEW.id, OLD.id)`. On DELETE, `NEW` is NULL, so `NEW.journal_id` would error in some PostgreSQL contexts. Also `RETURN COALESCE(NEW, OLD)` is non-standard for row-level triggers.

**Fix**: Split into two separate functions:
- One for `journals` table (uses `OLD.id`)
- One for `journal_lines` table (uses `OLD.journal_id`)
- Use `RETURN OLD` for DELETE triggers, `RETURN NEW` for UPDATE

---

## 5. HIGH: No Foreign Key from `journals.transaction_source_id` to `transactions`

**Problem**: `transaction_source_id` (line 87) has no FK constraint to your existing `transactions` table. Orphaned references can occur if a transaction is deleted.

**Fix**: Add `REFERENCES transactions(id) ON DELETE SET NULL` or at minimum a comment documenting that this is intentional.

---

## 6. MEDIUM: Balance Validation Trigger Fires Per Row, Not Per Statement

**Problem**: `trg_validate_balance` (line 203) is `FOR EACH ROW`. When inserting multiple lines in a single transaction (which is the normal case), the trigger fires after each line -- the first line will always be unbalanced and will raise an exception, even though you marked it `DEFERRABLE INITIALLY DEFERRED`.

**Nuance**: The deferred constraint trigger should work at commit time, but some edge cases with savepoints or client libraries that auto-commit can cause issues.

**Fix**: Test this carefully. Consider adding a `FOR EACH STATEMENT` trigger as a backup, or validate balance only in the `post_journal()` function (which you already do) and remove the per-row trigger.

---

## 7. MEDIUM: `uuid_generate_v4()` vs `gen_random_uuid()`

**Problem**: The schema uses `uuid_generate_v4()` (requires `uuid-ossp` extension) but your existing app uses `gen_random_uuid()` (built-in to PostgreSQL 13+ / `pgcrypto`). Mixing both works but is inconsistent.

**Fix**: Replace `uuid_generate_v4()` with `gen_random_uuid()` throughout to match existing tables and remove the `uuid-ossp` extension dependency.

---

## 8. MEDIUM: No `accounting_period_id` on Journals

**Problem**: The `prevent_posting_closed_period` trigger (line 209) does a date-range lookup against `accounting_periods`. If no period exists for a journal date, the trigger silently passes -- meaning journals can be created for dates with no defined period.

**Fix**: Either:
- Add a `period_id` FK column on `journals` and require it, OR
- Add a check that at least one matching open period exists (not just that no closed period blocks it)

---

## 9. MEDIUM: Income Statement Function Returns Grouped by `account_type` Only

**Problem**: The `income_statement()` function (line 428) groups by `account_type`, so you get exactly 2 rows (INCOME, EXPENSE) with no account-level detail.

**Fix**: Add a detailed version that groups by `account_code` + `account_name` for drill-down, and keep the summary version.

---

## 10. LOW: Missing `updated_at` Trigger on `accounting_periods`

**Problem**: You define `trg_update_periods` (line 265) but the `accounting_periods` table has `updated_at` defaulting to NULL, not `now()`. This is fine functionally but inconsistent with other tables.

---

## 11. LOW: No Audit Trail / Change Log

**Problem**: Soft deletes track *that* something was deleted, but not *who* deleted it or *what* changed. For accounting, audit trails are typically required.

**Suggestion**: Consider an `accounting_audit_log` table that captures `user_id`, `action`, `table_name`, `record_id`, `old_values`, `new_values`, `timestamp`.

---

## 12. LOW: Views Don't Filter by Period

**Problem**: `trial_balance` view shows all-time balances. Most accounting workflows need period-filtered trial balance.

**Fix**: Convert to a function like `trial_balance(p_start date, p_end date)` similar to how `income_statement` works.

---

## Summary of Required Changes Before Running

| Priority | Issue | Action |
|----------|-------|--------|
| Critical | RLS policies use wrong pattern | Rewrite using `has_role()` with `app_role` |
| Critical | Sequence created after trigger | Move sequence creation before trigger |
| High | `tsrange` on `date` columns | Change to `daterange` |
| High | Fragile posted-edit trigger | Split into two functions |
| High | No FK on `transaction_source_id` | Add FK or document |
| Medium | Balance trigger per-row issues | Test or move to post-only |
| Medium | `uuid_generate_v4` inconsistency | Switch to `gen_random_uuid()` |
| Medium | Journals without period allowed | Add period requirement |
| Medium | Income statement lacks detail | Add detailed version |
| Low | No audit log | Consider adding |
| Low | Trial balance not parameterized | Convert to function |

I can produce a corrected version of this SQL with all fixes applied whenever you're ready.

