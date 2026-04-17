
## Fix Replenish Fund — Petty Cash Transactions Not Detected

### Root Cause
In `ReplenishmentDialog.tsx`, two queries assume `pay_method = "petty_cash"` is a literal string. In this codebase, `pay_method` actually stores the **petty cash account's UUID** (confirmed against `transactions` table — all petty cash spends have `pay_method = <account_id>`, never the string `"petty_cash"`).

Result: `expensesSinceRecharge` always returns 0 → "Expected Cash" wrongly equals the fixed amount → over/short and replenishment amount are wrong, and a counted-cash equal to the fund makes the button disabled (replenishmentAmount = 0).

### Fix — `src/components/accounting/ReplenishmentDialog.tsx`

1. **`lastReplenishment` query**: identify recharges as transactions where `destination_acct_code = fund.id` AND `pay_method != fund.id` (i.e. money flowing IN from a non-petty-cash source). Replace `.neq("pay_method", "petty_cash")` with `.neq("pay_method", fund.id)`.

2. **`expensesSinceRecharge` query**: identify expenses as transactions where `pay_method = fund.id` (money flowing OUT of this specific fund). Replace `.eq("pay_method", "petty_cash")` with `.eq("pay_method", fund.id)`.

3. **Insert payload for the replenishment transfer**: the fields `transaction_direction: "payment"` and `is_internal: true` don't exist on `transactions`. Match the pattern used by `PettyCashView` recharge detection — a simple internal transfer row with `pay_method = sourceAccountId`, `destination_acct_code = fund.id`, `account_code = "0000"` (Internal Transfers, per project memory). Remove the two non-existent fields.

### Verification
After fix, opening Replenish on a fund will:
- Show the correct sum of expenses since the last recharge
- Compute Expected Cash = Fixed − Expenses correctly
- Produce the right Over/Short and Replenishment Amount
- Successfully insert a recharge transaction that the parent view recognizes (via the existing `isRecharge` logic)

### Files Changed
- `src/components/accounting/ReplenishmentDialog.tsx` (3 small edits)

### Risk
Low — read-query filter corrections + removal of two non-existent insert fields. No schema changes.
