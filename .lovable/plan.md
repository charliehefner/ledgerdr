

# Journal Entry Review & Approval Workflow

## Summary

Add a full review/approval UI to the Journal tab so an accountant (or admin/management) can open any draft journal entry, inspect and edit its lines, then post it -- or leave it as draft for later. The database already has the necessary columns (`posted`, `posted_by`, `posted_at`) and a trigger preventing edits to posted entries.

## What Changes

### 1. New Component: `JournalDetailDialog.tsx`

A dialog that opens when clicking a journal row, showing:

- **Header**: Journal number, date, description, currency, status badge
- **Editable lines table**: Account code (dropdown from `chart_of_accounts`), debit, credit amounts -- editable only while draft
- **Add/remove line buttons** (draft only)
- **Description edit** (draft only)
- **Footer actions**:
  - "Save Changes" -- saves edits to journal lines and description
  - "Post / Approve" -- sets `posted = true`, `posted_by = current user`, `posted_at = now()`. Shows a confirmation dialog since this is irreversible (the existing trigger blocks further edits)
  - "Delete" -- soft-deletes the journal (sets `deleted_at`)
- Posted journals open in **read-only mode** with a "Posted by [user] on [date]" indicator

### 2. Update `JournalView.tsx`

- Add a filter toolbar: "All | Drafts | Posted" toggle to filter by status
- Each row becomes clickable to open `JournalDetailDialog`
- Show totals (sum of debits/credits) in the expanded line view
- Add a "New Journal" button for manual entry creation (admin/management/accountant only, using `canWriteSection`)

### 3. New Component: `JournalEntryForm.tsx`

A dialog for creating new manual journal entries with:
- Date picker, description, currency selector
- Dynamic lines table: account selector + debit/credit inputs
- Real-time balance indicator (total debits vs credits -- must match to save)
- The existing `trg_validate_journal_balance` trigger enforces balance on save

### 4. Database Changes

**None required.** The schema already has everything needed:
- `journals.posted` (boolean, default false)
- `journals.posted_by` (uuid)
- `journals.posted_at` (timestamptz)
- `trg_no_edit_posted_journal` trigger prevents changes to posted entries
- `trg_validate_journal_balance` trigger ensures debit = credit
- RLS policies already allow accountant INSERT/UPDATE

### 5. Permission Enforcement

- Only users with write access to accounting (admin, management, accountant) see "Post", "Edit", "Delete", and "New Journal" buttons
- Viewers and supervisors see the journal in read-only mode
- The `canWriteSection(role, 'accounting')` check gates all write actions

## Files

| File | Action |
|------|--------|
| `src/components/accounting/JournalDetailDialog.tsx` | New -- review/edit/post dialog |
| `src/components/accounting/JournalEntryForm.tsx` | New -- create new journal entry |
| `src/components/accounting/JournalView.tsx` | Update -- add filters, "New" button, click-to-open |

## User Flow

1. Journals are created as **Borrador** (Draft) -- either auto-generated from transactions or manually
2. Accountant opens the Journal tab, sees list filtered to "Drafts"
3. Clicks a draft entry to open the detail dialog
4. Reviews the lines, edits accounts/amounts if needed, saves changes
5. Clicks "Aprobar y Publicar" (Approve & Post)
6. Confirms in the confirmation dialog
7. Entry becomes **Publicado** (Posted) and is now locked from further edits

