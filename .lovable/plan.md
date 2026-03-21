

## Drop Legacy `accounts` Table

The legacy `accounts` table (89 rows, flat codes) is completely unused by application code — no queries, no foreign keys reference it. The only reference is in the backup export list. Removing it eliminates confusion with the authoritative `chart_of_accounts` table.

### Step 1: Remove from backup export list
**File: `src/components/settings/backup/backupConstants.ts`** — Remove `'accounts'` from `TABLES_TO_EXPORT`.

### Step 2: Drop the table via migration
```sql
DROP TABLE IF EXISTS public.accounts;
```

This is safe because:
- Zero application queries reference `from('accounts')`
- No foreign keys point to it
- All 89 codes exist in `chart_of_accounts`

