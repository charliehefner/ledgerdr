## Bug

The "Modificado por: …" tooltip in the Schedule (Cronograma) cells never resolves a user — it stays on **"Cargando…"** indefinitely.

## Root cause

`src/components/cronograma/CronogramaGrid.tsx`:

```ts
async function fetchUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();   // ← always hits this
  …invoke("get-users")…
}
```

The query that calls it passes an empty array:

```ts
queryFn: async () => fetchUserEmails([]),
```

So the early-return on line 137 short-circuits the function before the `get-users` edge function is ever invoked. The query resolves with an empty Map, `userEmailMap.size === 0` stays true forever, and the tooltip permanently shows "Cargando…" / "Loading…".

(Confirmed: `get-users` itself is reachable and authenticated requests succeed — the client-side guard is the only blocker.)

## Fix

In `src/components/cronograma/CronogramaGrid.tsx`:

1. Drop the unused `userIds` parameter and the `uniqueIds.length === 0` early return from `fetchUserEmails`. The Cronograma intentionally pre-fetches the full directory once per session to power tooltips for every cell, so there is no list to filter on.
2. Add narrow `console.warn` logs in the error / unexpected-payload branches so future failures are visible in the browser console instead of silently producing an empty map.
3. Update the `useQuery` call to pass `fetchUserEmails` directly (no `[]` argument). The query key, staleTime, and gcTime stay the same so existing cache semantics are preserved.
4. Tighten the row mapper to skip entries missing `id` or `email`, in case `get-users` returns "Unknown" placeholders.

No changes to the `get-users` edge function, no DB or RLS changes, and no other consumers of `fetchUserEmails` exist (verified — it's only used inside this file).

## Verification after the fix

- Open Schedule → hover the small dot in the upper-right of any modified cell → the tooltip should show `Modificado por: <email>` and the timestamp instead of `Cargando…`.
- For cells where the editor's user has been deleted, the tooltip should show `Usuario desconocido` (existing fallback path) rather than `Cargando…`.
