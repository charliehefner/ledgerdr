## Goals

1. Replace the cedenojord-specific highlighting rule in the Schedule (Cronograma) with a universal rule that applies to every user.
2. Add a proper audit trail so every change is recorded and viewable on hover, even when no highlight is shown.
3. Remove `cedenojord` as an active user of the app.

---

## New highlighting rule (universal)

- **Original input** into a previously blank cell by **any** user → no orange/blue ring, no dot. The change is silently recorded in the audit trail and visible in the hover tooltip.
- **Edits to a cell that already has content**:
  - Within **24 hours** of the cell's original creation → no highlight (treated as a normal correction). Still recorded in audit + tooltip.
  - **24 hours or more** after original creation → highlight the cell with a subtle ring + dot, and identify the user in the hover tooltip.
- The current "trusted editors" allowlist (Iramaia, instructor) becomes obsolete and is removed — the 24h rule applies uniformly.
- The per-device "show indicators" toggle is preserved.

## Audit trail

Today the table only stores the latest `updated_by`/`updated_at`. A real audit trail requires a history table.

- New table `public.cronograma_entries_audit`:
  - `id uuid pk`, `entry_id uuid`, `entity_id uuid`, `week_ending_date date`
  - `worker_type`, `worker_id`, `worker_name`, `day_of_week`, `time_slot`
  - `action text` ('insert' | 'update' | 'delete')
  - `old_task text`, `new_task text`
  - `old_is_vacation bool`, `new_is_vacation bool`
  - `old_is_holiday bool`, `new_is_holiday bool`
  - `changed_by uuid`, `changed_at timestamptz default now()`
- Trigger `tg_cronograma_entries_audit` on `cronograma_entries` for INSERT/UPDATE/DELETE that writes one row per change. Skip when nothing meaningful changed (same task, same flags).
- RLS: select restricted to admin/management roles for the entry's entity (mirrors existing cronograma policies). Inserts only via the trigger (security definer).

## Hover tooltip — always on

- Tooltip is shown for **every cell that has any audit history**, not just highlighted ones.
- Content:
  - Most recent change: "Última edición: {user} — {date hh:mm}".
  - If older edits exist: an expandable mini-list of the last up to 5 entries (user + timestamp + short delta like "added text" / "changed text" / "cleared").
  - Highlighted cells additionally show "Editado >24h después de la creación" / "Edited >24h after creation".
- A new lightweight query (`useCronogramaAudit`) fetches audit rows for the visible week+entity in one round trip and indexes them by `cellKey` for the tooltip.

## Code changes

`src/components/cronograma/CronogramaGrid.tsx`
- Remove `CEDENOJORD_ID`, `INSTRUCTOR_ID`, `TRUSTED_EDITOR_IDS`, `SELF_EDIT_HIGHLIGHT_HOURS`.
- Rewrite `getHighlightType(entry)`:
  - Return `null` if `created_at === updated_at` (original input, never highlighted).
  - Return `null` if `updated_at - created_at < 24h`.
  - Otherwise return `"late-edit"` (single highlight type — orange ring + dot).
- Rewrite tooltip builder to read from the audit query when available, falling back to `updated_by/updated_at` if audit not yet loaded.
- Always render the cell inside a `Tooltip` when there is any audit history (not gated on `isHighlighted`). Keep the dot/ring gated on `isHighlighted && showIndicators`.
- Update memo comparator to include audit-row count/last-change for the cell.

`supabase/migrations/<new>.sql`
- Create table, indexes (`entry_id`, `(entity_id, week_ending_date)`), enable RLS, add policies, create trigger function + trigger.
- Backfill: insert one synthetic 'insert' audit row per existing `cronograma_entries` using `created_by`/`created_at`, plus an 'update' row when `updated_at <> created_at` using `updated_by`/`updated_at`. This preserves history for existing data.

## Remove cedenojord as a user

- Use the existing `delete-user` edge function (admin-only) to schedule deletion of `cedenojord@internal.jord.local` (`3976a9b9-…`). It is deferred to next midnight by default; we will pass `immediate: true` so processing runs right away.
- The deletion only removes the auth user + `user_roles`. Existing `cronograma_entries.created_by/updated_by` references stay (they are uuid columns, not FKs to auth.users), so historical attributions remain intact and the audit trail keeps working — the tooltip will show "user: 3976a9b9" for past edits where the email is no longer resolvable, which is acceptable.

## Out of scope / not changing

- `cronograma_entries` schema itself (columns unchanged).
- Save/persistence logic fixed in the previous round.
- The per-device indicator toggle behavior.

## QA checklist

1. New cell typed into → no highlight, hover shows "Creado por X — fecha".
2. Same cell edited within 24h by a different user → no highlight, hover shows both entries.
3. Same cell edited 24h+ later by any user → orange ring + dot, hover shows full history.
4. Old cells from cedenojord still display correctly (backfilled audit row).
5. After deleting cedenojord, login fails for that account; existing schedule data unchanged; tooltips still render with id-prefix fallback.
