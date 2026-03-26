

## Record Petty Cash Reset Transfer

### What we'll do
Insert a **transfer transaction** of **DOP 5,378.93** from **BHD DOP 36900090011** to **Caja Chica Finca**, dated today. This resets the petty cash starting balance going forward.

### Steps

1. **Insert a transfer transaction** into the `transactions` table:
   - `transaction_date`: today (2026-03-26)
   - `amount`: 5378.93
   - `currency`: DOP
   - `transaction_direction`: payment (transfer)
   - `pay_method`: `84653770-3920-484a-8aa5-3dc8b71a0603` (BHD DOP)
   - `destination_acct_code`: `31227d8e-93c7-4ce7-99fc-99a91255ef5d` (Caja Chica Finca)
   - `description`: "Transferencia a Caja Chica Finca — reinicio de fondo"
   - `is_internal`: true
   - `master_acct_code`: "0000" (internal transfer)

2. **No code changes needed** — this is a data operation only. The transaction will appear in the Petty Cash view as a recharge and will set the running balance baseline.

3. **Fixed amount stays at 5,000** as requested — no schema or config changes.

### Result
After this transfer, the Petty Cash Finca running balance will start from 5,378.93 and all future expenses/replenishments will track from there.

