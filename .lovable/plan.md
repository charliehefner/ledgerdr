## Defer auto-reload while a form is dirty

Add a lightweight "dirty form" guard to the version-check self-healing system in `src/main.tsx` so users mid-edit are never yanked into a reload.

### How it works

1. **Track dirty state globally** — expose a tiny module on `window.__dirtyForms` (a `Set<string>`) plus helper hooks `markDirty(id)` / `markClean(id)`.
2. **Defer reload when dirty** — in `purgeAndReload()`, if `__dirtyForms.size > 0`, skip the immediate reload and instead:
   - Set a pending flag (`__pendingReload = true`) and remember the new version.
   - Listen once for the set going empty, or for the next `visibilitychange → hidden` event, then reload.
3. **Browser-native safety net** — register a single `beforeunload` handler that returns a confirmation string only when `__dirtyForms.size > 0`. This catches manual refreshes too, not just our auto-reload.
4. **Wire up the heaviest forms** — call `markDirty` / `markClean` in:
   - `src/components/transactions/TransactionForm.tsx` (on field change / on submit / on close)
   - `src/components/hr/PayrollTimeGrid.tsx` (on cell edit / on save)
   - `src/components/budget/BudgetGrid.tsx` (on edit / on save)
   - `src/components/operations/` two-stage entry forms (on edit / on close/submit)
   Other forms can opt in later — the default behavior stays unchanged.

### Files touched

- `src/main.tsx` — add dirty registry, `beforeunload` handler, defer logic in `purgeAndReload`.
- `src/lib/dirtyForms.ts` *(new)* — exports `markDirty`, `markClean`, `useDirtyForm(id, isDirty)` React hook.
- 4 form components above — one-line `useDirtyForm` call each.

### Trade-offs

- Users with a dirty form see the standard browser "Leave site?" prompt on manual refresh/close. Acceptable — that's the whole point.
- Auto-reload is delayed until the form is clean OR the tab is backgrounded. Worst case: a user keeps a dirty form open all day and stays on the old build until they save or switch tabs. Acceptable; same as today's behavior without this guard.
- No new dependencies, no DB changes, dev mode unaffected.
