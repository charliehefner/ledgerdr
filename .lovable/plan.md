# Add FX Translation Gain/Loss line to P&L (Option B — position-based)

## Goal

Add an explicit **"Ganancia/(Pérdida) por Tipo de Cambio"** line to the P&L, computed from **USD-denominated balance-sheet positions** at period end. Makes the FX impact of single-DOP-column reporting transparent and consistent.

## Calculation method

For every USD-denominated balance-sheet account (`chart_of_accounts.currency = 'USD'` AND `account_type IN ('asset','liability','equity')`):

```
usd_balance_at_end   = SUM(debit − credit) in USD over posted lines through p_end
                       (lines on journals where currency = 'USD')
book_dop_balance     = SUM((debit − credit) × journals.exchange_rate)
reported_dop         = usd_balance_at_end × p_closing_rate
fx_impact_per_acct   = reported_dop − book_dop_balance
fx_translation_total = SUM across all USD balance-sheet accounts
```

Standard closing-rate translation difference for monetary items. Captures unrealized FX on USD cash, bank, AR, AP.

## Implementation

### 1. New RPC: `compute_period_fx_translation`

```sql
CREATE OR REPLACE FUNCTION public.compute_period_fx_translation(
  p_end_date date,
  p_closing_rate numeric,
  p_entity_id uuid DEFAULT NULL
) RETURNS TABLE (
  account_id uuid, account_code varchar, account_name text,
  usd_balance numeric, book_dop_balance numeric,
  reported_dop_balance numeric, fx_impact numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH usd_lines AS (
    SELECT jl.account_id,
           (jl.debit - jl.credit) AS usd_delta,
           (jl.debit - jl.credit) * COALESCE(j.exchange_rate, 1) AS dop_delta
    FROM journal_lines jl
    JOIN journals j ON j.id = jl.journal_id
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE j.posted = true
      AND j.deleted_at IS NULL AND jl.deleted_at IS NULL
      AND j.journal_date <= p_end_date
      AND j.currency = 'USD'
      AND coa.currency = 'USD'
      AND coa.account_type IN ('asset','liability','equity')
      AND (p_entity_id IS NULL OR j.entity_id = p_entity_id)
  )
  SELECT coa.id, coa.account_code, coa.account_name,
         SUM(ul.usd_delta), SUM(ul.dop_delta),
         SUM(ul.usd_delta) * p_closing_rate,
         (SUM(ul.usd_delta) * p_closing_rate) - SUM(ul.dop_delta)
  FROM usd_lines ul
  JOIN chart_of_accounts coa ON coa.id = ul.account_id
  GROUP BY coa.id, coa.account_code, coa.account_name
  HAVING SUM(ul.usd_delta) <> 0;
$$;
GRANT EXECUTE ON FUNCTION public.compute_period_fx_translation TO authenticated;
```

Returns per-account detail; the P&L sums `fx_impact` for the single line; rows feed a drill-down dialog.

### 2. Double-counting guard

Check `revaluation_log` for `revaluation_date` inside the report period. If found:
- Suppress the calculated line.
- Show note: *"Revaluación FX ya posteada en este período — el efecto está incluido en las cuentas operativas."*

### 3. P&L view changes (`ProfitLossView.tsx`)

- Call `compute_period_fx_translation(p_end, closingRate, entityId)` after fetching balances.
- Render the aggregated value at the bottom of "Otros Ingresos/Egresos" (positive = gain, negative in parentheses).
- Include in subtotals so Net Income reconciles.
- Hide when **"Mostrar monedas nativas"** toggle is ON.
- Add ⓘ tooltip: *"Diferencia entre saldos USD valuados al tipo de cambio de cierre y los saldos contabilizados en libros."*
- Update Excel and PDF exports.

### 4. Drill-down dialog

New `FxTranslationDetailDialog.tsx`: clickable line opens a dialog with per-account breakdown (code, USD balance, book DOP, reported DOP, FX impact).

### 5. i18n

Add to `es.ts` and `en.ts`:
- `fxTranslationGainLoss`, `fxTranslationTooltip`, `fxRevaluationAlreadyPosted`, `fxTranslationBreakdown`

## Files

- **New migration**: `compute_period_fx_translation` RPC
- **Modified**: `src/components/accounting/ProfitLossView.tsx`
- **New**: `src/components/accounting/FxTranslationDetailDialog.tsx`
- **Modified**: `src/i18n/es.ts`, `src/i18n/en.ts`

## Out of scope

- Same line on Cash Flow (separate phase).
- Splitting realized vs. unrealized FX.
- OCI/Equity treatment for non-monetary items.

## Risks & mitigations

- **Double-counting with `revalue_open_ap_ar`**: mitigated by `revaluation_log` check.
- **Non-USD journals touching USD accounts**: excluded by `j.currency = 'USD'` filter; flagged during QA.
- **Performance**: single aggregation through period end; existing indexes should suffice.