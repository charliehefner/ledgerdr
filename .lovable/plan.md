

## Fix: Payment Method Not Rendering in Financial Ledger (Reports)

### Problem
The Reports page (`src/pages/Reports.tsx`) displays `tx.pay_method` raw, which is often a bank account UUID. The Transactions page already resolves these UUIDs to human-readable names via `getPayMethodLabel()` backed by a `bank_accounts` query -- but Reports never implemented this.

### Fix

**`src/pages/Reports.tsx`** -- three changes:

1. **Add bank accounts query** (same pattern as `RecentTransactions.tsx`):
   - Query `bank_accounts` table for `id, account_name, account_type, currency`

2. **Add pay method resolution function**:
   - `getPayMethodLabel()` that checks legacy string labels first (transfer_bdi, cash, etc.), then falls back to bank account UUID lookup, mirroring the existing logic in `RecentTransactions.tsx`

3. **Replace raw display** on line 729:
   - Change `{tx.pay_method || "-"}` to `{getPayMethodLabel(tx.pay_method)}`
   - Also update the pay method filter dropdown to show resolved names
   - Also update the export `getValue` for payMethod (line ~299) to use the same resolution

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Add bank_accounts query, getPayMethodLabel helper, use it in table cell + filter + export |

