

## Fix: Schedule Input Lag and Sticky Headers

### Root Cause of Slowness

The Schedule grid has **three performance problems**:

1. **Every cell re-renders on any mutation success.** When a user leaves a cell (blur), `upsertMutation.mutate()` fires, and `onSuccess` calls `queryClient.invalidateQueries()` which refetches ALL entries and re-renders every single cell in the grid (employees × 6 days × 2 slots = 100+ cells). Users feel this as a "stutter" after each edit.

2. **Linear scans on every render.** `getCellValue()` and `getEntryForCell()` both do `entries.find()` — an O(n) scan — and they're called for every cell during every render pass. With many entries, this compounds.

3. **TooltipProvider wraps each highlighted cell individually**, creating many context providers.

### Changes (single file: `CronogramaGrid.tsx`)

**1. Memoize entry lookups with a Map**
- Build a `Map<string, CronogramaEntry>` keyed by `"workerName|workerType|day|slot"` once via `useMemo`, replacing all `entries.find()` calls with O(1) lookups.

**2. Debounce the mutation, not the input**
- Keep the current blur-to-save approach but add a short debounce (300ms) to the `upsertMutation.mutate` call so rapid tab-between-cells doesn't fire overlapping mutations.
- Use `queryClient.setQueryData` for optimistic local update instead of waiting for refetch, making the UI feel instant.

**3. Memoize `CronogramaCell` with `React.memo`**
- Wrap the cell component in `React.memo` with a custom comparator so cells only re-render when their specific value, highlight, or disabled state changes — not on every grid-wide refetch.

**4. Lift `TooltipProvider` to grid level**
- Move the single `<TooltipProvider>` to wrap the entire table instead of creating one per highlighted cell.

**5. Make column headers sticky**
- Add `sticky top-0 z-20` to the `<thead>` element so day/slot headers stay visible when scrolling vertically.

### Expected Result
- Typing and tabbing between cells will feel instant
- Column headers (days + AM/PM) stay pinned at the top when scrolling
- No functional changes to save behavior or data

