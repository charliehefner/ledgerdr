## Diagnosis: 3 distinct issues in the Schedule (Cronograma)

### Issue 1 — Horizontal scrollbar can't be dragged
The grid is wrapped in a Radix `<ScrollArea>` (line 787 of `CronogramaGrid.tsx`). Radix uses a virtual (overlay) scrollbar that:
- doesn't accept native two-finger trackpad horizontal swipes inside long tables
- often gets "trapped" behind the sticky header / sticky first column
- doesn't respond to Shift+wheel

That's why the only way Iramaia can navigate columns is `Tab` (which moves focus cell-by-cell and triggers native scroll-into-view).

**Fix:** Replace `<ScrollArea>` + `<ScrollBar orientation="horizontal" />` with a plain native scroll container:
```tsx
<div className="w-full overflow-x-auto overflow-y-visible">
  <div className="min-w-[900px]"> ... table ... </div>
</div>
```
Native browser scrollbar → click-drag works, trackpad swipe works, Shift+wheel works, keyboard arrows work.

---

### Issue 2 — Copy/paste is unreliable
Current behavior in `CronogramaCellMemo.handleKeyDown` (line 1055):
```ts
if (e.ctrlKey && e.key === "v" && hasCopied) {
  e.preventDefault();
  onPaste();   // pastes the in-grid copiedTask, NOT the OS clipboard
}
```
- If she copies text from **outside** the grid (Word, WhatsApp, another browser tab), Ctrl+V is hijacked and pastes whatever was last copied **inside** the grid (or nothing).
- If nothing was ever copied in-grid, Ctrl+V silently does nothing useful.
- Ctrl+C also fires `onCopy(localValue)` which copies the **entire cell** even if she selected just one word — overwriting the OS clipboard.

**Fix:**
1. **Remove the Ctrl+V hijack.** Let the browser handle Ctrl+V natively into the textarea — that's what users actually expect.
2. **Make Ctrl+C native too** — only stash `copiedTask` when the user explicitly clicks the existing "Copy" UI (the small toast indicator at the top), not on every Ctrl+C. We'll keep the in-grid copy/paste available via a right-click context menu item ("Copiar celda completa" / "Pegar celda copiada") and remove the keyboard shortcuts entirely. Simpler and predictable.

After the fix:
- Ctrl+C / Ctrl+V behave exactly like in any text input — copy/paste with the OS clipboard.
- The "duplicate this whole cell to another cell" workflow stays available but moves to right-click, so it doesn't fight the native clipboard.

---

### Issue 3 — User shows "Usuario desconocido" for several seconds
In `CronogramaGrid.tsx` line 270:
```ts
useQuery({
  queryKey: ["user-emails-cronograma", entries.map(e => e.updated_by).filter(Boolean)],
  queryFn: () => fetchUserEmails(...),
  enabled: entries.length > 0,
})
```
Problems:
- The query key is a **new array on every render** → React Query refires constantly, and while in flight `userEmailMap` is empty → tooltips render "Usuario desconocido".
- The Edge Function `get-users` returns **all users anyway** (it ignores the `userIds` arg — confirmed in code). Auth logs show it makes ~14 sequential `/admin/users/{id}` calls → ~300ms+ on first load.
- `enabled: entries.length > 0` adds another delay on first paint.

**Fix:**
```ts
useQuery({
  queryKey: ["all-user-emails"],          // stable, shared across the app
  queryFn: () => fetchUserEmails([]),     // returns full directory
  staleTime: 1000 * 60 * 30,              // 30 min cache
  gcTime: 1000 * 60 * 60,
})
```
- Stable key → fetched once per session, reused everywhere.
- Cached for 30 min → no "unknown" flicker when she navigates weeks or refocuses the tab.
- We can keep `enabled: true` always so the directory is preloaded the moment the page mounts.

Optional small extra: in `getTooltipContent`, fall back to "Cargando…" instead of "Usuario desconocido" while the map is still empty — so even on the very first cold load she sees a friendlier label.

---

### Bonus — small console warning
React warns: `Function components cannot be given refs … Check the render method of CronogramaCell`. This comes from `<TooltipTrigger asChild>` wrapping a `<div>` inside a memoized component that doesn't forward refs. Wrapping the inner `<div>` with `React.forwardRef` (or just removing the unnecessary `asChild`) will silence the warning. Cosmetic — included as a tidy-up.

---

### Files changed
- `src/components/cronograma/CronogramaGrid.tsx`
  - Swap `<ScrollArea>` for native `overflow-x-auto` div
  - Remove Ctrl+C / Ctrl+V handlers from textarea; keep in-grid copy via right-click context menu
  - Stabilize `userEmailMap` query (key, staleTime, eager)
  - Forward ref on tooltip wrapper to clear console warning

### Risk
Low. All changes are localized to the Cronograma grid component. No DB, no schema, no other modules affected. The right-click menu preserves the existing "duplicate cell" workflow so nothing is lost.
