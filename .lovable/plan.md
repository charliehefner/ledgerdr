

## Auto-fit Code/Description column to content

The column currently has fixed constraints (`minWidth: 140px`, `max-w-[200px]`, `max-w-[120px]` on the description span) that prevent it from naturally sizing to content.

Since the table already uses `w-max` (line 583), columns will naturally size to their content — we just need to **remove all the artificial width constraints** on the first column and let the browser's table layout do the work.

### Changes in `src/components/budget/BudgetGrid.tsx`

1. **Line 31**: Remove the first column from `COL_W` width calculations — no fixed width needed. Or simply keep it as a small `minWidth` fallback (e.g. `100`) but not a cap.

2. **Line 406 (td)**: Remove `max-w-[200px]`. Keep `whitespace-nowrap` so it sizes to content.

3. **Line 408 (description span)**: Remove `truncate`, `inline-block`, `max-w-[120px]`, and `align-bottom`. Just render the text naturally.

4. **Line 586 (th)**: Keep `whitespace-nowrap`, remove any `width`/`maxWidth` constraints.

The `w-max` table will then auto-size the first column to exactly fit the longest code+description, no more, no less.

