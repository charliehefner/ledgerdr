

## Apply 6 Pending Migrations

**Status:** All 6 migration files exist in `supabase/migrations/` but none have been applied to the live database. The last applied version is `20260411170738`.

| Migration | Description | Status |
|-----------|-------------|--------|
| 20260411180001 | Create transaction with AP/AR | Missing |
| 20260411180002 | Account balances balance_dop | Missing |
| 20260411180003 | RLS fix 1 — restore core accounting | Missing |
| 20260411180004 | RLS fix 2 — payroll snapshots | Missing |
| 20260411180005 | RLS fix 3 — entity-scoped tables (746 lines of RLS policies) | Missing |
| 20260411180006 | RLS fix 4 — AP/AR and fuel submissions | Missing |

### Plan

1. **Apply each migration in order** using the database migration tool, executing the SQL content of each file sequentially (180001 → 180006).

2. **Verify** by querying `supabase_migrations.schema_migrations` to confirm all 6 versions are present.

3. **Spot-check** that the 4 RLS policies on `transactions` exist after 180005 runs.

### Risk Note
Migration 180005 is large (746 lines) and creates RLS policies across many tables. If any referenced function (e.g., `user_has_entity_access`, `has_role_for_entity`) or table doesn't exist, that migration will fail. I'll review each file before executing and handle errors if they arise.

