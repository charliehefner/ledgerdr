## Goal

Add an explicit **"Ganancia/(Pérdida) por Tipo de Cambio"** line to the Profit & Loss statement. This makes the FX translation impact transparent now that the P&L is displayed in a single DOP "reporting currency" column.

## How the number is calculated

For every posted journal line in the period that has a USD amount, we compute:

```
fx_impact_per_line = usd_amount × (closing_rate − line.fx_rate)
fx_gain_loss_total = SUM(fx_impact_per_line)
```

Where:
- `usd_amount` and `fx_rate` are stored on each journal line at the time of booking.
- `closing_rate` is the BCRD USD/DOP sell rate at period-end (already provided by `useExchangeRate` and overridable via the manual input that already exists in the P&L view).

This is the standard "translation difference" under the closing-rate method and ties out: `Σ(booked DOP) + FX line = Σ(usd × closing_rate)`.

## Implementation

### 1. New RPC: `compute_period_fx_translation`

Created via migration. Signature:

```sql
compute_period_fx_translation(
  p_start_date date,
  p_end_date date,
  p_closing_rate numeric,
  p_entity_id uuid DEFAULT NULL
) RETURNS numeric
```

Logic (simplified):

```sql
SELECT COALESCE(SUM(
  jl.usd_amount * (p_closing_rate - COALESCE(jl.fx_rate, p_closing_rate))
), 0)
FROM journal_lines jl
JOIN journals j ON j.id = jl.journal_id
WHERE j.entry_date BETWEEN p_start_date AND p_end_date
  AND j.posted = true
  AND jl.usd_amount IS NOT NULL
  AND jl.usd_amount <> 0
  AND (p_entity_id IS NULL OR j.entity_id = p_entity_id);
```

I'll first inspect the actual `journals` / `journal_lines` schema to confirm exact column names (`posted`, `entry_date`, `fx_rate`, `usd_amount`, `entity_id`) and adjust the RPC accordingly. If the column is named differently (e.g., `is_posted`, `transaction_date`), the RPC will use the correct names.

`SECURITY DEFINER` with `search_path = public`. Granted EXECUTE to authenticated.

### 2. Double-counting guard

Period-end FX revaluation (existing `PeriodRevaluationButton`) already posts journal entries that book the same effect to a P&L FX account. To avoid double-counting:

- Detect whether revaluation journals exist for the period (e.g., journals with a `source = 'fx_revaluation'` or matching the existing detection logic — to be confirmed by reading `PeriodRevaluationButton.tsx` and the journals schema).
- If revaluation journals exist for the period: **suppress** the calculated line and instead show a small note: *"Revaluación FX ya posteada — ver libro diario"*.
- If not: show the calculated line.

### 3. P&L view changes (`ProfitLossView.tsx`)

- After fetching account balances, call the new RPC with the period-end date, the active closing rate, and the current entity filter.
- Render the result as a new line at the bottom of the "Otros Ingresos/Egresos" section, formatted in the same single DOP reporting column. Sign convention: positive = gain, parentheses for loss.
- Include the line in subtotals so Net Income reconciles.
- When the **"Mostrar monedas nativas"** toggle is ON (dual-column view), hide the FX line — it's only meaningful in the single-column reporting view.
- Update Excel and PDF exports to include the line when visible.

### 4. i18n

Add keys to `src/i18n/es.ts` and `src/i18n/en.ts`:
- `fxTranslationGainLoss`: "Ganancia/(Pérdida) por Tipo de Cambio" / "FX Translation Gain/(Loss)"
- `fxRevaluationAlreadyPosted`: "Revaluación FX ya posteada — ver libro diario" / "FX revaluation already posted — see journal"

## Files

- **New migration**: create `compute_period_fx_translation` RPC
- **Modified**: `src/components/accounting/ProfitLossView.tsx`
- **Modified**: `src/i18n/es.ts`, `src/i18n/en.ts`

## Out of scope

- Applying the same line to Cash Flow or Balance Sheet (BS translation differences would go to OCI/Equity, not P&L — separate phase).
- Splitting realized vs. unrealized FX (would require knowing which USD positions were settled in the period).
- Per-account breakdown of the FX impact (single aggregate line for v1).

## Risks

- **Schema assumptions**: RPC depends on exact column names in `journal_lines` / `journals`. Will be verified against the live schema before writing the migration.
- **Double-counting with revaluation**: Mitigated by the detection + suppression logic above.
- **Closing rate missing for date**: `useExchangeRate` already falls back to most recent prior rate; manual override input remains.
