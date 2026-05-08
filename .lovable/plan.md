## Issue

In **Treasury → Internal Transfers → Recent Transfers**, the "ID" column currently shows the first 8 chars of the UUID (e.g. `a1b2c3d4`). The user-visible transaction number shown in **Transactions → Recent Transactions** (e.g. `627`) is the `legacy_id` column, not the UUID. So transfer #627 looks like a different ID in the two screens.

## Fix

In `src/components/accounting/InternalTransfersView.tsx`:

- Render `r.legacy_id ?? "-"` in the ID cell (matching the format used in `RecentTransactions.tsx` line 191).
- Keep the UUID in `title={r.id}` for hover/debug.
- The query already does `select("*")`, so `legacy_id` is already fetched — no query change needed.

That's the only change. No backend, no migration.
