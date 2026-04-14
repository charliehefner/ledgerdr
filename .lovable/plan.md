

## Fix: Timesheet Changes Not Reflected in Summary & Close

### Problem
When you edit timesheet data (e.g., remove a holiday marking), the Summary & Close tab still shows the old cached payroll preview. The preview query uses `enabled: false` (manual trigger only) and its cache key `["payroll-preview", periodId]` is never invalidated when timesheet data changes.

### Solution
Invalidate the payroll preview cache whenever timesheet data is modified, so the next time the user views the Summary tab, the stale data is cleared and they see a prompt to re-preview (or it auto-refreshes).

### Changes

**`src/components/hr/PayrollTimeGrid.tsx`** — Add `queryClient.invalidateQueries({ queryKey: ["payroll-preview"] })` in these locations:

1. **Upsert mutation `onSuccess`** (line ~256) — when any timesheet cell is saved
2. **Absence toggle `onSettled`** (line ~286) — when absence is toggled
3. **Auto-fill handler** (line ~387) — after bulk auto-fill
4. **Holiday toggle** (line ~536) — after marking/unmarking a holiday

Each is a single line addition alongside the existing `["timesheets", periodId]` invalidation. This ensures that any timesheet change clears the stale payroll preview, forcing a fresh RPC call on the Summary tab.

No other files need changes. The Summary component already handles the "no preview data" state correctly.

