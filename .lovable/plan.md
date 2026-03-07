

## Unrealized Exchange Rate Gain/Loss Revaluation

### What it does

At period-end, all open USD-denominated balances (receivables, payables, bank accounts) are revalued using the closing exchange rate from the `exchange_rates` table. The difference between the original booked rate and the closing rate is posted as a journal entry to account **8510 — Diferencia Cambiaria** (which already exists in the chart of accounts).

### How it works

The system identifies monetary accounts with foreign currency balances by scanning posted journal lines in accounts like:
- **Receivables** (11xx, 12xx — asset accounts with USD activity)
- **Payables** (21xx — liability accounts with USD activity)
- **Bank accounts** (10xx with USD currency)

For each account with a net USD balance, it compares:
- **Booked DOP value** = sum of (debit - credit) × original `exchange_rate` from journals
- **Revalued DOP value** = net USD balance × closing-date sell rate from `exchange_rates`
- **Adjustment** = Revalued − Booked → posted to 8510

### Changes

#### 1. Database: `revaluation_log` table (migration)
Track which periods have been revalued to prevent duplicates:
- `id`, `period_id`, `journal_id`, `revaluation_date`, `closing_rate`, `total_adjustment`, `created_at`, `created_by`
- RLS: read for authenticated, insert for admin/accountant

#### 2. Database function: `foreign_currency_balances(p_start, p_end)`
SQL function returning per-account USD balances and their booked DOP equivalent from posted journals within the date range. This provides the data needed to calculate adjustments.

#### 3. New component: `PeriodRevaluationButton.tsx`
Similar pattern to `PeriodClosingButton.tsx`. Placed next to the closing button in `PeriodsView.tsx`.

Logic:
1. Fetch the closing-date sell rate from `exchange_rates` (latest rate on or before `end_date`)
2. Call `foreign_currency_balances(start_date, end_date)` to get net USD positions per account
3. For each account: compute adjustment = (usd_balance × closing_rate) − booked_dop_total
4. Create a draft **ADJ** journal with lines debiting/crediting each account vs. 8510
5. Log to `revaluation_log`
6. Show toast with summary

The journal is created as a **draft** (not posted) so it can be reviewed before posting — same pattern as period closing.

#### 4. Update `PeriodsView.tsx`
Render `PeriodRevaluationButton` in each period row, next to the existing `PeriodClosingButton`. Only visible for open/closed periods (not reported/locked).

#### 5. Journal number sequence
Add a new sequence `journal_seq_adj` and handle prefix `'ADJ'` in the `generate_journal_number()` trigger.

### UI Flow

User goes to Accounting → Períodos → clicks **"Revaluación Cambiaria"** on a period → confirmation dialog shows the closing rate and estimated adjustment → generates a draft ADJ journal → user reviews and posts it via normal workflow.

