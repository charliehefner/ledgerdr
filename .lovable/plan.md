# Fix: `Cannot read properties of undefined (reading 'toFixed')` on /analytics

## Root cause

`src/components/analytics/CostPerFieldTab.tsx` calls `r.hectares_worked.toFixed(2)` and `r.operation_count` / `r.input_cost_dop` directly on rows returned by RPC `get_cost_per_field`. When any row has a NULL value for those numeric columns (e.g., a field with operations logged but no recorded hectares), the component crashes and the ErrorBoundary takes over.

This is **unrelated to the recent FX translation work** — it's a pre-existing fragility exposed by current data on the Analytics page.

Stack trace points to line 468 of a previously bundled version; in the current 217-line file the same pattern exists at lines **79, 87, 88, 127, 169, 200, 207** (and matching `input_cost_dop` / `operation_count` reduces).

## Fix

Defensively coerce all numeric fields read from the RPC to numbers with a `0` fallback, then call `.toFixed()` / arithmetic on the safe value.

Pattern:
```ts
const ha   = Number(r.hectares_worked) || 0;
const ops  = Number(r.operation_count) || 0;
const cost = Number(r.input_cost_dop)  || 0;
```

### Edits to `src/components/analytics/CostPerFieldTab.tsx`

1. **Export rows (line 79 and 169)** — replace `r.hectares_worked.toFixed(2)` with `(Number(r.hectares_worked) || 0).toFixed(2)`, and wrap `r.input_cost_dop` / `r.operation_count` similarly.
2. **Aggregations (lines 86-88 and farm-level reducers)** — wrap each accumulator term with `Number(...) || 0`.
3. **Table cells (lines 127, 200, 207)** — same `Number(...) || 0` guard before `.toFixed()`.
4. **Display of cost / counts** — apply the same guard so a NULL cost renders as `0.00` instead of `NaN` or crash.

No schema changes, no RPC changes — purely a defensive client-side fix.

## Out of scope

- Investigating *why* some rows have NULL hectares (likely operations logged without `hectares_worked`). Can be a follow-up if the user wants those rows excluded server-side instead.
- Other analytics tabs — only `CostPerFieldTab` is implicated by the stack trace, but a quick `rg` for the same `.toFixed` pattern in the other Analytics tabs is included as a verification step.

## Verification

After the edit, navigate to `/analytics` → Cost per Field tab; the page should render without the ErrorBoundary, and any NULL-hectares row should show `0.00`.
