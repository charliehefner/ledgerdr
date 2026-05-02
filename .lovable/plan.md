## Goal

Add an Excel-style "drag handle" to each Schedule cell so users can fill the **task text** of adjacent cells in a straight line (horizontal across days/slots, or vertical across workers). Target cells are **overwritten** regardless of prior content. Each filled cell still goes through the existing save path, so audit and the 24h highlight rule keep working unchanged.

## Behavior

**Desktop (mouse)**
- A small fill handle (4×4 px square, accent color) appears at the bottom-right of the **focused / hovered** cell when the week is editable.
- Mouse-down on the handle starts a fill drag. Moving the mouse over other cells extends a dashed selection rectangle from the source cell along **one axis only** — whichever axis the cursor has moved further along (horizontal vs vertical), locked once chosen.
  - Horizontal axis = same worker row, across morning/afternoon slots and days (Mon AM, Mon PM, Tue AM, …).
  - Vertical axis = same day + slot column, across workers (in the order currently rendered).
- Mouse-up commits: the source cell's task string is written to every target cell in the selection, overwriting whatever was there.
- Esc during drag cancels.

**Tablet (touch)**
- Long-press (~500 ms) on the fill handle activates fill mode (haptic-style visual pulse on the handle).
- Dragging the finger highlights cells along the locked axis, same as mouse.
- Lift to commit, tap outside or press Esc-equivalent (back gesture / tap source cell) to cancel.
- Plain taps and short presses on the handle do nothing (so accidental taps don't fill).

**Scope of what is copied**
- Only the `task` text. `is_vacation` and `is_holiday` flags on target cells are preserved.
- Empty source → fills targets with empty (acts as a bulk clear along the axis). This is consistent with overwrite semantics; if you'd rather block empty-source drags, say so and I'll add a guard.

**Cells that are skipped even when in the selection**
- Cells in rows/columns that are read-only because the week is closed (`isWeekClosed`) — drag handle won't appear at all in that case.
- Cells flagged as vacation or holiday for that worker/day — these are already non-editable in the grid; they will be visually included in the dashed rectangle but skipped on commit, with a small toast like "3 celdas omitidas (vacaciones/feriado)".

## Save pipeline & audit

- Each target cell is written via the existing `handleCellChange(worker, dayOfWeek, timeSlot, value)` function. No new mutation, no new RLS surface, no schema change.
- Writes are dispatched in a tight loop (await-less, since `upsertMutation.mutate` is fire-and-forget and already debounced/queued). Optimistic cache updates already handled by `handleCellChange` keep the UI snappy.
- The audit trigger logs one row per cell automatically.
- The 24h highlight rule applies per cell as usual: a freshly filled cell whose underlying row was created >24h ago will highlight; a brand-new row will not. (This is intentional and consistent with single-cell editing.)

## Technical changes

Single file: `src/components/cronograma/CronogramaGrid.tsx`.

1. **New local state** at the grid level:
   - `fillSource: { workerKey, dayOfWeek, timeSlot, task } | null`
   - `fillTargets: Set<string>` (cell keys currently in the dashed rectangle)
   - `fillAxis: "horizontal" | "vertical" | null`

2. **Cell ordering refs** for axis traversal:
   - Build a memoized ordered list of `(workerKey, dayOfWeek, timeSlot)` tuples in render order. Used to compute the inclusive range from source to current hover along the locked axis.

3. **Fill handle UI**: tiny absolutely-positioned `<span>` in the bottom-right of each editable cell wrapper; visible on hover/focus and during a drag from that cell.
   - `onMouseDown` → start fill, capture pointer.
   - `onTouchStart` + 500 ms timer → start fill on long-press; cancel timer on touchmove > a few px before threshold or touchend.

4. **Global drag listeners** (window level, attached only while a drag is active):
   - `mousemove`/`touchmove`: hit-test the cell under the pointer using `document.elementFromPoint`, read `data-cell-key` from the cell wrapper, recompute axis lock + target set.
   - `mouseup`/`touchend`: commit, then clear state.
   - `keydown` Esc: cancel.

5. **Commit**: iterate the target keys, look up each `(worker, day, slot)` from existing maps, call `handleCellChange(...)` with the source task. Skip vacation/holiday cells. Show one summary toast.

6. **Cell wrappers** get `data-cell-key={cellKey(...)}` and `position: relative` so the handle and dashed overlay anchor correctly. The dashed selection is drawn by adding a Tailwind `ring-2 ring-dashed ring-accent` (or equivalent) class to cells whose key is in `fillTargets`.

7. **Performance**: hit-testing on every move would be expensive with 100+ cells. Throttle `mousemove`/`touchmove` to `requestAnimationFrame`. Memoize the cell-key → index map.

8. **No DB / migrations / edge function changes.**

## Out of scope

- Diagonal / rectangular fills (Excel-style 2D selection).
- Drag-fill across vacation rows that are entirely read-only (grayed out).
- Undo for the whole fill as a single action (each cell still individually undoable through normal edit + audit history).

## QA checklist

1. Hover a cell → small handle appears bottom-right; disappears when week is closed.
2. Drag horizontally across 4 cells → all 4 take the source task; audit shows 4 update rows.
3. Drag vertically across 5 workers in the same column → all 5 filled; vacation rows skipped with toast.
4. Drag in an L-shape → axis locks to whichever direction the cursor moved more first, ignores the other.
5. Esc during drag → no writes, dashed rectangle disappears.
6. Long-press handle on iPad → drag mode activates; quick tap does nothing.
7. After fill, cells edited 24h+ after their row's `created_at` show the orange highlight; freshly-created rows do not — consistent with single-cell rule.
