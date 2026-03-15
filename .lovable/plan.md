

## Narrow the Code/Description column in BudgetGrid

**File**: `src/components/budget/BudgetGrid.tsx`, line 31

The first column width is hardcoded at `200px`. Change it to a smaller, auto-fitting approach:

1. **Reduce `COL_W[0]` from `200` to `140`** — enough for a 4-digit code + short description
2. **Change `width` to `minWidth` only** on the code column header (line 586) so it can shrink but won't grow unnecessarily. Currently both `minWidth` and `width` are set to `COL_W[0]`, which forces exact 200px. Remove the `width` constraint.
3. **Add `max-w-[200px]` with `truncate`** on the data rows (line 406) so long descriptions get truncated with ellipsis rather than expanding the column.

This keeps the sticky positioning working (since `stickyLeft` is computed from `COL_W`) while making the column compact.

