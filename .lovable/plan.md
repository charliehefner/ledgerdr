## Goal

Make the Schedule (Cronograma) hover tooltip always show the latest edits — including who edited and when — without requiring a manual refresh.

## Changes

### 1. Force fresh fetches on the two queries that drive the grid + tooltip

File: `src/components/cronograma/CronogramaGrid.tsx`

On both queries, add overrides to the global 5-minute `staleTime`:

- `["cronograma-entries", weekEndingDate, selectedEntityId]`
- `["cronograma-audit", weekEndingDate, selectedEntityId, entryIdsKey]`

Add to each:
```ts
staleTime: 0,
refetchOnMount: "always",
refetchOnWindowFocus: true,
```

Effect: every time you open or return focus to the Schedule tab, both the cell contents and the audit history are refetched, so other users' edits become visible immediately.

### 2. Add Realtime subscription for live collaborative updates

In `CronogramaGrid`, add a `useEffect` that subscribes to a Supabase Realtime channel on:

- `cronograma_entries` (filter `week_ending_date=eq.<currentWeek>`)
- `cronograma_entries_audit` (filter `week_ending_date=eq.<currentWeek>`)

On any insert / update / delete event, invalidate both queries above. Tear the channel down on unmount or when the week / entity changes.

Effect: when Iramaia saves a change, your open Schedule tab refetches within ~1 second and the tooltip updates without you doing anything.

### 3. Enable Realtime on the audit table

One-line migration to add the audit table to the realtime publication (`cronograma_entries` is already published):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.cronograma_entries_audit;
```

No RLS changes needed — the existing `Authenticated can view cronograma audit` policy already permits the SELECT that Realtime performs on subscribers' behalf.

## Out of scope

- No changes to the audit trigger (it's already capturing inserts and updates correctly).
- No tooltip layout changes.
- No periodic server-side cron (not technically possible against in-browser caches, and Realtime is strictly better for this use case).

## Verification

1. Hard refresh once after deploy.
2. Open `/cronograma` for the week ending 2026-05-09 and hover ANA ESTRELLA / Thu AM. Tooltip header should read "Última edición: irabassoi@gmail.com — 02 May 2026 21:01" with "• charliehefner@gmail.com creó — 02 May 2026 09:36" beneath.
3. With two browsers open on the same week, edit a cell in one — the other should reflect the new text + new "Última edición" line within ~1 second, no refresh.
