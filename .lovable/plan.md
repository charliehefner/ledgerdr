

# Backup & Export Page — Implementation Plan

## Problem

The backup system has a critical gap: `TABLES_TO_EXPORT` lists 46 tables but the database has **79 tables**. Missing tables include `journals`, `journal_lines`, `chart_of_accounts`, `bank_accounts`, `fixed_assets`, `contacts`, `tax_codes`, and 26 others. The hardcoded `schemaSql.ts` file (942 lines) also goes stale with every migration.

## Solution

1. **Create a database function** (`get_all_public_tables`) that returns every public table name, so the backup dynamically discovers tables instead of relying on a hardcoded list.

2. **Replace the static table list** in the backup logic — fetch the live table list from the database, then export ALL tables. Keep a dependency-ordered priority list for INSERT ordering (FK safety), but append any newly discovered tables at the end.

3. **Generate schema SQL dynamically** — instead of the static `schemaSql.ts`, query `pg_dump`-style metadata from `information_schema.columns` to generate CREATE TABLE statements at backup time, ensuring new columns and tables are always captured.

4. **Add a dedicated Backup tab** in Settings (admin-only) with:
   - **7-day warning banner** if no backup has been downloaded recently
   - **Data Backup section** — the existing download button with progress, plus table/row count summary after export
   - **Schema Reference section** — read-only textarea showing all public tables from the RPC, with a visual indicator of which tables are covered vs missing from the backup

## Technical Details

### Migration: `get_all_public_tables()` RPC

```sql
CREATE OR REPLACE FUNCTION public.get_all_public_tables()
RETURNS TABLE(table_name text, row_estimate bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    t.table_name::text,
    COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
  FROM information_schema.tables t
  LEFT JOIN pg_stat_user_tables s 
    ON s.relname = t.table_name AND s.schemaname = 'public'
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;
```

### File Changes

| File | Change |
|------|--------|
| Migration | Create `get_all_public_tables()` function |
| `backupConstants.ts` | Convert `TABLES_TO_EXPORT` to a priority-ordered list; add logic to merge with live table list |
| `backupUtils.ts` | Add `fetchAllTableNames()` using the new RPC; update `fetchTableData` to accept any string (not just the const type) |
| `src/components/settings/BackupExportView.tsx` | **New file** — Backup tab component with warning banner, backup button, and schema reference textarea |
| `src/pages/Settings.tsx` | Add "Backup" tab (admin-only), remove `DatabaseBackup` from General tab |
| `src/components/settings/DatabaseBackup.tsx` | Refactor to use dynamic table list from RPC instead of static constant |
| `src/i18n/en.ts` + `src/i18n/es.ts` | Add i18n keys for the new tab, warning banner, and schema reference section |

### Key Design Decisions

- **No edge function for ZIP generation** — stays client-side (JSZip) to avoid Deno memory limits
- **Dynamic schema discovery** — the RPC returns row estimates too, so the admin sees table sizes at a glance
- **FK-safe ordering** — the existing ordered list is kept as a priority hint; any table not in it gets appended alphabetically after the known ones
- **Static `schemaSql.ts` stays** as a fallback/reference but the backup will also include a dynamically generated schema snapshot from `information_schema.columns`

