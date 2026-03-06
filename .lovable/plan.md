

## Add Running Balance Column to Petty Cash Transactions

Add a "Balance" column to the recent transactions table that computes a running balance. Since transactions are sorted newest-first, the calculation will iterate in chronological order (reverse the array), starting from the fund's `fixed_amount`, then subtract expenses and add recharges.

### Changes in `src/components/accounting/PettyCashView.tsx`

1. **Compute running balances** — After `recentTx` is loaded, create a derived array with a `balance` field:
   - Sort transactions chronologically (oldest first)
   - Start balance at the fund's `fixed_amount` (use the first petty cash account's fixed amount, or 0)
   - For each transaction: if recharge, add amount; if expense, subtract amount
   - Reverse back to newest-first for display

2. **Add "Balance" column** — New `<TableHead>` and `<TableCell>` after "Monto", showing the running balance in monospace font. Negative balances shown in red.

3. **Note**: As you mentioned, historical transactions won't reflect the correct starting point, but going forward the balance will track correctly from each replenishment.

