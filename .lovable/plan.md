

## Add Project, CBS, Reconciliation Status, and Reference to Journals

### Problem
The journal list and detail views don't show project codes, CBS codes, reconciliation status, or a reference description — all of which the accountant needs.

### Database Changes

**Add two columns to `journals` table:**
- `is_reconciled` (boolean, default false) — tracks whether this journal has been reconciled in bank reconciliation
- `reference_description` (text, nullable) — free-text reference field (e.g., invoice number, check number)

No changes needed for project/CBS — `journal_lines` already has `project_code` and `cbs_code` columns.

### UI Changes

**1. Journal List (`JournalView.tsx`)**
- Add columns: **Proyecto** (aggregated from lines), **CBS** (aggregated from lines), **Ref.**, **Conc.** (reconciliation badge)
- Query must now include `is_reconciled` and `reference_description` from journals
- Project/CBS display: show unique values from journal lines, comma-separated if multiple

**2. Journal Detail Dialog (`JournalDetailDialog.tsx`)**
- Add **Reference Description** text field (editable for drafts, read-only for posted)
- Add **Reconciled** badge in the header
- Show **Project** and **CBS** columns in the lines table (editable for drafts via text inputs)
- Persist `project_code` and `cbs_code` per line when saving
- Persist `reference_description` on the journal when saving

**3. Journal Entry Form (`JournalEntryForm.tsx`)**
- Add **Reference Description** field
- Add **Project** and **CBS** input fields per line

### Technical Details
- The `is_reconciled` field on journals will also be set to `true` when a bank statement line is matched to a journal (update `QuickEntryDialog.tsx` and `BankReconciliationView.tsx` to set this)
- Project/CBS are free-text fields on `journal_lines` already — just need UI exposure
- Migration: `ALTER TABLE journals ADD COLUMN is_reconciled boolean DEFAULT false; ALTER TABLE journals ADD COLUMN reference_description text;`

