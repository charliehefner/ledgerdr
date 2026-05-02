## What I found

I checked the database directly. Your entries **are** being saved successfully:

- Week ending **2026-05-09** (next Saturday) just received 6 entries with `task = "Feriado"` (Monday AM) between 12:01:16 – 12:01:35 today — your most recent edits.
- Week ending **2026-05-02** received 88 entries today, latest at 11:59:59.
- All saved under your user id and the correct entity.

So the upsert (`CronogramaGrid.tsx` lines 362–439) is working. The "Failed to fetch" errors in the console are **token-refresh** failures (transient network blips on `_refreshAccessToken`), not save failures.

## Most likely reasons it *looks* like nothing saves

1. **Optimistic update only patches existing entries.** In `handleCellChange` (lines 510–522), the cache patcher uses `findIndex` and only updates when an entry already exists. For brand-new cells the typed text is **not** added to the cache — it relies on the server round-trip + `invalidateQueries` to repaint. If the 300 ms debounce is interrupted (you click into another cell, navigate weeks, or the tab refetches before the network reply arrives), the cell visually "snaps back" to empty even though the row was inserted server-side.
2. **No success feedback.** Unlike errors (which `toast.error`), successful saves are silent, so there is no confirmation the data landed.
3. **Debounced mutation can be lost on unmount/navigation.** `debounceTimerRef` is a 300 ms `setTimeout`. If you change weeks, switch entity, or close the tab within 300 ms of the last keystroke, the pending mutation is dropped (the timer is cleared on the next change but the previous payload is gone).

## Plan to fix

### 1. Make optimistic updates handle inserts, not just updates
In `handleCellChange`, when no existing entry is found, append a synthetic entry to the cache so the cell stays populated until the server confirms. On error rollback to previous snapshot.

### 2. Flush pending debounced mutation on cell-blur and on unmount
- Add a `flush()` helper that immediately fires the pending mutation if a timer is active.
- Call it on input `onBlur`, on week navigation, on entity change, and inside a `useEffect` cleanup.

### 3. Add lightweight save feedback
- Per-cell "saving…" indicator (small dot) while the mutation is in flight, switching to a green check for 1 s on success.
- Keep the existing toast for errors.

### 4. Use proper React-Query optimistic pattern
Convert `upsertMutation` to use `onMutate` / `onError` / `onSettled` so cache updates and rollbacks live with the mutation, not in `handleCellChange`. This removes the duplication and the snap-back behavior.

### 5. Guard against the "All Entities" mode silently blocking writes
`requireEntity()` returns `null` in All-Entities mode and the mutation throws `"Seleccione una entidad antes de guardar."`. Today that toast appears once but the cell still shows the typed text optimistically, suggesting it saved. Disable the input (and show a banner) when no entity is selected, instead of letting the user type and only seeing an error toast.

## Files to change
- `src/components/cronograma/CronogramaGrid.tsx` — items 1-5 above.

## Out of scope
- The `Failed to fetch` token-refresh errors — those are transient network issues unrelated to Schedule saves and should not be chased now.
