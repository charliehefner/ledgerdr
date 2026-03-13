

## Fix: Day Labor Close via Backend Function (No Supervisor Transaction Access)

### Problem
The day labor week close inserts into `transactions` from the client. Supervisors don't have (and shouldn't have) RLS access to `transactions`. The previous plan incorrectly proposed giving supervisors transaction access.

### Solution
Create a **security definer** database function `close_day_labor_week(p_week_ending date)` that:
1. Marks all `day_labor_entries` for that week as `is_closed = true`
2. Inserts the corresponding transaction into `transactions` (account 7690, DOP, etc.)
3. Returns the created transaction ID

Since it's `SECURITY DEFINER`, it runs with the function owner's privileges, bypassing RLS — supervisors never get direct transaction access.

Then update `DayLaborView.tsx` to call this RPC instead of doing client-side updates + `createTransaction()`.

### Backfill
Include an INSERT for the missing transaction from the week ending 2026-03-13 (RD$ 4,100.00) in the same migration.

### Changes

| Item | Detail |
|------|--------|
| **New migration** | `close_day_labor_week(p_week_ending date)` — security definer function that marks entries closed + inserts transaction. Also backfills the missing 2026-03-13 transaction. |
| **`src/components/hr/DayLaborView.tsx`** | Replace the `closeWeek` mutation body: call `supabase.rpc('close_day_labor_week', { p_week_ending })` instead of manual update + `createTransaction()`. Keep PDF generation and receipts ZIP as-is (client-side). |

No new RLS policies for supervisors on `transactions`. No other files changed.

