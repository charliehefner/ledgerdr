

## Investigation Results

The `close_day_labor_week` database function **has never existed**. The week ending 2026-03-13 was successfully closed because the code at that time performed the close logic **inline** (direct INSERT into `transactions` + UPDATE on `day_labor_entries`). At some point between March 13 and now, the close code was refactored to call `supabase.rpc("close_day_labor_week", ...)`, but the corresponding database function was never created.

Historical closed weeks confirm the pattern: `pay_method` was `'Transfer BHD'` (the legacy string), and the current bank account is **BHD DOP 36900090011** (UUID: `84653770-3920-484a-8aa5-3dc8b71a0603`).

## Plan

### Step 1: Create the `close_day_labor_week` database function

Create a `SECURITY DEFINER` function that:
1. Validates unclosed entries exist for the given `week_ending_date`
2. Calculates the total amount
3. Inserts a transaction into `transactions` with:
   - `master_acct_code = '7690'`
   - `pay_method = '84653770-3920-484a-8aa5-3dc8b71a0603'` (BHD DOP account UUID)
   - `currency = 'DOP'`, `transaction_direction = 'purchase'`, `is_internal = true`
   - `description = 'Jornales Semana ' || formatted date`
4. Marks all matching entries as `is_closed = true`
5. Returns the new transaction ID

### Step 2: No frontend changes needed

The existing `DayLaborView.tsx` RPC call already matches the function signature (`p_week_ending date`).

### Files changed
- New database migration — `close_day_labor_week` function

