

## Fix: Budget and Forecast Save Errors

### Problem
When editing both Budget and Forecast (or any two fields) on the same row, the first edit creates the row via INSERT. Before the query cache refreshes, the second edit also tries INSERT — hitting the unique constraint and failing.

### Root Cause
`handleBlur` (line 320) checks `lineMap[lineCode]` to decide INSERT vs UPDATE. But `lineMap` only updates after the query refetch completes. Rapid edits on a new row race against the refetch.

### Solution
Change the upsert mutation to **always check for an existing row first** via a SELECT before deciding to INSERT or UPDATE. This eliminates the race condition.

### Changes

**`src/components/budget/BudgetGrid.tsx`** — modify the `upsertMutation` (lines 287-318):

1. When no `lineId` is provided, run a SELECT query first using the unique key columns (`budget_type`, `project_code`, `fiscal_year`, `line_code`, `parent_line_id`, `sub_label`)
2. If a matching row is found, UPDATE it instead of INSERTing
3. If no row exists, INSERT as before

This is a ~15-line change inside the `mutationFn` at line 288. No other files affected.

