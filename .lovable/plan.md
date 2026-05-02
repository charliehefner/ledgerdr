# Add `RESTORE.md` to the repo

## Goal

Document, in one file checked into the repo, the exact steps to restore a
**Settings → Backup** ZIP into a plain **PostgreSQL + PostGIS** install on a
laptop — so the backup is a usable cold copy even if Lovable Cloud is
unreachable.

The file is documentation only. No code changes, no schema changes.

## Where it goes

New file at the repo root: `RESTORE.md` (sibling of `README.md`, `package.json`).

## Outline of the contents

1. **What this is / what it isn't**
   - It's a cold, read-only backup on plain Postgres.
   - It is NOT a live mirror — no auth, no RLS enforcement, no edge functions,
     no realtime, no storage API. Use a GUI (DBeaver / pgAdmin / TablePlus) or
     `psql` to read it.

2. **What's in the backup ZIP** (matches the actual `DatabaseBackup.tsx` output)
   ```text
   00_schema.sql        -- tables, enums, functions
   01_data.sql          -- INSERTs with ON CONFLICT DO NOTHING (idempotent)
   02_rls_policies.sql  -- SKIP on plain Postgres (uses auth.uid / has_role)
   03_triggers.sql      -- mostly OK; a few reference auth — see notes
   04_storage.sql       -- SKIP (Supabase storage schema only)
   backup.json          -- full data dump in JSON
   tables/*.json        -- per-table JSON
   attachments/
     transactions/...   -- NCF files
     employees/...      -- HR documents
   metadata.json        -- export summary
   README.md            -- auto-generated summary
   ```

3. **Prerequisites on the laptop**
   - PostgreSQL 15+ and PostGIS installed
   - `psql` on the PATH
   - A GUI of choice (DBeaver recommended — free, handles PostGIS)

4. **One-time setup**
   ```sh
   createdb ledgerdr_backup
   psql ledgerdr_backup -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   psql ledgerdr_backup -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
   psql ledgerdr_backup -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
   # Stub auth.uid() so triggers/functions that reference it still load:
   psql ledgerdr_backup <<'SQL'
   CREATE SCHEMA IF NOT EXISTS auth;
   CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
     LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
   CREATE OR REPLACE FUNCTION auth.role() RETURNS text
     LANGUAGE sql STABLE AS $$ SELECT 'postgres'::text $$;
   SQL
   ```

5. **Loading a backup ZIP**
   ```sh
   unzip ledgerdr-backup-YYYY-MM-DD.zip -d ./backup
   cd backup
   psql ledgerdr_backup -v ON_ERROR_STOP=0 -f 00_schema.sql
   psql ledgerdr_backup -v ON_ERROR_STOP=0 -f 01_data.sql
   # Skip 02_rls_policies.sql and 04_storage.sql on plain Postgres.
   # 03_triggers.sql: load it; ignore errors on triggers that depend on auth.
   psql ledgerdr_backup -v ON_ERROR_STOP=0 -f 03_triggers.sql
   ```
   Note: `01_data.sql` uses `ON CONFLICT DO NOTHING`, so you can re-run it
   later with a fresher ZIP to top up new rows without breaking existing ones.

6. **Restoring attachments**
   - Move the `attachments/` folder somewhere stable, e.g.
     `~/ledgerdr-backup/attachments/`.
   - The `transaction_attachments.attachment_url` column still points at the
     cloud URL. To resolve a file locally, strip the prefix
     `https://<project>.supabase.co/storage/v1/object/public/transaction-attachments/`
     and look under `attachments/transactions/`. Same idea for
     `employee-documents` → `attachments/employees/`.
   - Optional helper SQL view example (included in the doc) that exposes a
     `local_path` column for convenience.

7. **Browsing the data**
   - `psql ledgerdr_backup` for ad-hoc queries.
   - DBeaver / pgAdmin / TablePlus for spreadsheet-style browsing, CSV export,
     ER diagrams.
   - Common queries cheat-sheet (last N transactions, journal totals by
     account, payroll for a period, etc.) — 4–5 examples.

8. **Refreshing the backup**
   - Weekly: download a new ZIP from **Settings → Backup**, re-run step 5.
   - Old attachments are kept; new ones added on top.
   - Schema drift: if `00_schema.sql` adds new tables/columns, they'll be
     created; existing tables are left as-is (the schema script uses
     `CREATE TABLE IF NOT EXISTS`).

9. **What is NOT restored (and why)**
   - `auth.users`, sessions, passwords (Supabase-managed).
   - RLS policies (depend on `auth.uid()` / `has_role()`).
   - Storage bucket policies.
   - Edge function secrets — keep these in a password manager.
   - Realtime publications.

10. **If you ever want a live local copy**
    - Pointer to `mem://technical/migration/digitalocean-blueprint` and to the
      Supabase self-hosting docs. Out of scope for this file.

## Out of scope

- Modifying the backup export itself (no changes to
  `src/components/settings/backup/*` or `DatabaseBackup.tsx`).
- Adding a "plain-Postgres-friendly" SQL variant to the export.
- Building any local viewer UI.

If you later want a pre-stripped, plain-Postgres-friendly schema variant added
to the export ZIP, that's a separate follow-up.
