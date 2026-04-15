

## Server-Side Pagination for Transactions and Operations

### Problem
Both views fetch all rows at once (500 transactions, unlimited operations), causing 1-3 second delays. As data grows, this will worsen significantly.

### Approach
Move from "fetch everything, paginate client-side" to "fetch only the current page from the database." The first page loads fast; navigating pages triggers a small, quick query.

### Changes

**1. `src/lib/api.ts` — `fetchRecentTransactions`**
- Add `offset` parameter alongside existing `limit`
- Add a separate count query using `.select('*', { count: 'exact', head: true })` to get total rows without fetching data
- Return `{ data, totalCount }` instead of just an array

**2. `src/components/transactions/RecentTransactions.tsx`**
- Replace the client-side `usePagination` hook with server-side pagination state (`page`, `pageSize`)
- Pass `offset = page * pageSize` and `limit = pageSize` to the fetch function
- Include `page` and `pageSize` in the React Query key so page changes trigger new fetches
- Keep the existing pagination UI controls (they already render correctly)

**3. `src/components/operations/OperationsLogView.tsx`**
- Add server-side pagination to the operations query (`.range(from, to)`)
- Add a count query for total filtered operations
- Add the same pagination UI controls already used in Transactions
- Client-side filtering (date range, farm, field) will be converted to server-side `.eq()` / `.gte()` / `.lte()` filters so counts and pages are accurate
- Sorting will also move server-side using `.order()`

**4. `src/hooks/usePagination.ts`** — No changes needed (remains available for other views)

### Risk Assessment
- **Low risk**: Pagination is additive — no schema changes, no RLS changes, no data mutations
- **Backward compatible**: All existing filters, sorting, and export features continue to work
- **Faster initial load**: First page fetches only 20 rows instead of 500+
- **Export**: The export buttons will need a separate "fetch all filtered" query (not paginated) to maintain full-data exports

### Technical Detail
- Supabase `.range(from, to)` handles offset pagination efficiently with existing indexes on `created_at` and `operation_date`
- Count queries use `{ count: 'exact', head: true }` which is lightweight
- React Query cache means revisiting a page you already loaded is instant

