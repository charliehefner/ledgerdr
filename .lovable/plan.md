## Bug

Schedule cells still show **"Modificado por: … (auto-edición tardía) — Loading…"** in some cases. The earlier fix made `fetchUserEmails` actually call `get-users`, but the tooltip can still get permanently stuck on "Cargando…/Loading…" whenever:

- The `get-users` invoke fails or times out for that session (non-admin roles, transient errors, slow cold starts), so `userEmailMap` stays size 0.
- The user who edited the cell is not returned by `get-users` (e.g. a deleted user, or `auth.users` lookup returned no email — those rows are filtered out as "Unknown" on line 156, so the id is missing from the map).

In both cases, the cell has a real `updated_by` id, the lookup misses, and the fallback chain in `getTooltipContent` (lines 1127–1130) drops to **"Cargando…"** because it only treats `userEmailMap.size === 0` as the "still loading" branch and never times out.

## Fix

Edit `src/components/cronograma/CronogramaGrid.tsx`:

1. **Remove the "Cargando…/Loading…" branch entirely.** The tooltip should never be a loading indicator — it's a hover popover that needs to render something useful immediately. Replace lines 1127–1130 so `userDisplay` resolves to:
   - `modifierEmail` if known,
   - otherwise `"Usuario desconocido"` / `"Unknown user"`.
   That alone fixes the stuck-"Loading…" symptom regardless of why the lookup missed.

2. **Surface the actual react-query state** so a real fetch in flight is distinguishable from a permanent miss. Pull `isLoading` and `isError` from the `useQuery({ queryKey: ["all-user-emails"] })` call (lines 305–310), pass them down through `userEmailMap` consumers (the two `<EditableCell …>` usages at lines 969 and 990, and the `EditableCell` props interface at line 1044). Inside `getTooltipContent`, only show "Cargando…" when `isLoading === true` — never when the query has settled.

3. **Make `fetchUserEmails` more forgiving.** Today, line 156 drops users whose email came back as the literal string `"Unknown"`, which means edits by those users will *never* resolve. Change it to keep the row using `u.email ?? u.id.slice(0, 8)` as a display fallback so the tooltip always shows *something* tied to the editor.

4. **Add a one-time retry on transient failure.** Set `retry: 1, retryDelay: 1500` on the `useQuery` for `all-user-emails` so a cold-start failure of the `get-users` edge function doesn't permanently leave the map empty for the session.

No DB, RLS, or edge-function changes needed; `get-users` already returns id+email for non-admins.

## Verification

- Hover the dot in the upper-right of a flagged cell:
  - Known editor → `Modificado por: <email> (auto-edición tardía)\n<date>` ✔
  - Unknown / deleted editor → `Modificado por: Usuario desconocido (auto-edición tardía)\n<date>` ✔ (no more permanent "Cargando…")
  - During the very first fetch only → briefly `Cargando…`, then resolves on its own.
- Confirm in the browser console there are no `[Cronograma] get-users …` warnings during a normal session; if there are, the retry should clear them on the second attempt.
