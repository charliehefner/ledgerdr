I found the likely reason it still did not work: the tooltip logic was fixed, but the memoized schedule cell is not allowed to re-render when the user email lookup finishes. The custom `React.memo` comparator ignores both `userEmailMap` and `isUserEmailMapLoading`, so cells can keep the first rendered tooltip text, e.g. `Cargando…`, even after the query resolves.

Plan:

1. Update the schedule cell memo comparator
   - In `src/components/cronograma/CronogramaGrid.tsx`, include `isUserEmailMapLoading` in the custom comparator.
   - This will force highlighted cells to re-render when the user-directory lookup changes from loading to loaded.

2. Add a stable lookup version for the user map
   - Because a `Map` object itself should not be compared deeply in every cell, compute a lightweight stable version/signature in the parent from the map contents.
   - Pass that version into each cell.
   - Include it in the memo comparator so cells also re-render when the loaded map content changes.

3. Make the fallback more definitive
   - Keep `Cargando…` only while the lookup is actively loading.
   - Once loading is complete, show the resolved email, `user:xxxxxxxx`, or `Usuario desconocido`.

4. Verification
   - Re-open the schedule grid and check an already-highlighted old cell.
   - Confirm the tooltip no longer remains stuck on `Cargando…` after the user lookup finishes.

No database changes are needed.