

## Add `exchange_rates` to Database Backup

The `exchange_rates` table is missing from the backup export list in `backupConstants.ts`. It needs to be added so daily BCRD rates are included in the IT migration package.

### Change

**File: `src/components/settings/backup/backupConstants.ts`**

Add `'exchange_rates'` to the `TABLES_TO_EXPORT` array. It has no foreign key dependencies, so it can be placed near the end of the list (before `scheduled_user_deletions`).

