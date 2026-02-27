

## Plan: Add Journal Types (GJ, PJ, SJ, PRJ) with Prefix-Based Numbering

### Current State
- 161 journals exist (all from transactions, all GJ-prefixed)
- Single sequence `journals_journal_number_seq` at 322
- All transactions currently have `transaction_direction = 'purchase'`
- `create_journal_from_transaction` RPC accepts 4 params, no journal_type

### Database Migration

**1. Add column + new sequences**
```sql
ALTER TABLE journals ADD COLUMN journal_type varchar(3) NOT NULL DEFAULT 'GJ';
CREATE SEQUENCE journal_seq_pj START 1;
CREATE SEQUENCE journal_seq_sj START 1;
CREATE SEQUENCE journal_seq_prj START 1;
CREATE SEQUENCE journal_seq_cdj START 1;
CREATE SEQUENCE journal_seq_crj START 1;
```

**2. Replace `generate_journal_number()` trigger function**
Reads `NEW.journal_type`, picks the matching sequence, formats as `{TYPE}-000001`. Existing GJ sequence continues for GJ entries.

**3. Update `create_journal_from_transaction` RPC**
Add `p_journal_type varchar DEFAULT 'GJ'` parameter, pass it into the INSERT.

**4. Backfill existing journals**
Set `journal_type = 'PJ'` for all journals that have a `transaction_source_id` (since all current transactions are purchases). Keep existing GJ- numbers unchanged.

### Frontend Changes

**`src/components/accounting/useJournalGeneration.ts`**
- Pass `journal_type: 'PJ'` for purchases/investments, `'SJ'` for sales to the updated RPC

**`src/components/accounting/JournalEntryForm.tsx`**
- Add journal type selector (GJ default) in the header fields grid
- Pass `journal_type` in the insert call

**`src/components/accounting/JournalDetailDialog.tsx`**
- Display journal type badge next to journal number
- Allow editing journal_type via dropdown for draft journals (saves on handleSave)

**`src/components/accounting/JournalView.tsx`**
- Add journal_type to the query select
- Add type filter buttons (All, GJ, PJ, SJ, PRJ) or a dropdown alongside existing status filter
- Display journal_type in the table

### Technical Detail: Updated Trigger

```sql
CREATE OR REPLACE FUNCTION generate_journal_number()
RETURNS trigger AS $$
DECLARE seq_num bigint; prefix text;
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
$$ LANGUAGE plpgsql SET search_path TO 'public';
```

### Files Modified
- 1 database migration (column, sequences, trigger, RPC, backfill)
- `src/components/accounting/useJournalGeneration.ts`
- `src/components/accounting/JournalEntryForm.tsx`
- `src/components/accounting/JournalDetailDialog.tsx`
- `src/components/accounting/JournalView.tsx`

