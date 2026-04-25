## Goal

Convert all four financial statements (P&L, Balance Sheet, Trial Balance, Cash Flow) to display a **single DOP "reporting currency" column** instead of dual DOP/USD columns. Use the **closing rate** for conversion and add an explicit **"Ganancia/Pérdida por Tipo de Cambio"** line on the P&L to show FX impact transparently.

This simplifies reports, aligns with DGII filing currency, and lays the groundwork for cleaner multi-entity side-by-side views later.

## Approach

### 1. FX rate sourcing (already in place)
- `useExchangeRate(date)` hook already pulls the most recent BCRD USD/DOP `sell_rate` from the `exchange_rates` table on or before a given date.
- The reports already have a manual "Tipo de Cambio (USD→DOP)" input that auto-populates from this hook. We'll keep the manual override (useful for what-if scenarios) but use it as the closing rate for everything.
- For Balance Sheet → use rate at "as of" date.
- For P&L / Cash Flow → use rate at the **period-end** date (closing rate, per user choice).
- For Trial Balance → use rate at the "as of" date.

### 2. Default display: single DOP column
Each report becomes single-currency by default:

```
Account     | DOP (Reporting)
Ventas      |  2,400,000     ← native DOP + (USD × closing rate)
```

The existing `r.rdTotal` (DOP native) and `r.usTotal` (USD native) totals already exist in component state. The new "reporting" total = `rdTotal + (usTotal × closingRate)`.

### 3. Toggle for native-currency view
Add a switch labeled **"Mostrar monedas nativas"** at the top of each report. When ON, restores today's dual-column DOP / USD view. Default OFF (single-column reporting view).

### 4. FX gain/loss line on P&L
Add a new line at the bottom of "Otros Ingresos/Egresos" section:

```
Ganancia/(Pérdida) por Tipo de Cambio    XX,XXX
```

Calculation (simple closing-rate method): For each USD-denominated balance sheet account (cash, AP, AR), the FX gain/loss = `usTotal × (currentClosingRate − priorPeriodClosingRate)`. For P&L purposes (single-period view without comparison), we'll compute it as the difference between USD balances translated at closing rate vs. the rate they were originally booked at (already tracked via the journals' `fx_rate` field).

A simpler v1: query the difference between `SUM(usd_amount × journal_fx_rate)` and `SUM(usd_amount × closingRate)` across USD-denominated journal lines for the period. This gives the unrealized translation gain/loss.

### 5. Files to modify

- `src/components/accounting/ProfitLossView.tsx` — add toggle, single-column rendering, FX gain/loss line, update Excel/PDF export
- `src/components/accounting/BalanceSheetView.tsx` — add toggle, single-column rendering, update exports
- `src/components/accounting/TrialBalanceView.tsx` — add toggle, single-column rendering, update exports
- `src/components/accounting/CashFlowView.tsx` — already largely single-currency (DOP-converted with USD/EUR fallback rates); add the toggle for consistency + adopt the same FX rate sourcing

### 6. No database changes required
All conversion happens client-side using data the RPC already returns (per-currency balances). The `exchange_rates` table is already populated.

## What stays the same
- Single-entity users see no behavioral change beyond the new default (single DOP column) and the toggle to flip back.
- All existing Excel and PDF exports continue to work — they'll respect the toggle state.
- DGII reports, journals, and the underlying ledger remain untouched (always native currency).
- Multi-entity consolidation is **not** in scope for this phase — explicitly deferred.

## Risks & mitigations

- **Risk**: Users expecting to see USD totals will be confused.
  **Mitigation**: Toggle is one click away, labeled clearly in Spanish. Footnote on each report shows the closing rate used.

- **Risk**: FX gain/loss calculation could double-count if the user has already run period-end FX revaluation (which posts journal entries for the same effect).
  **Mitigation**: Detect whether revaluation journals exist for the period; if yes, suppress the calculated FX line and show "Ver Revaluación FX en libro diario" note instead.

- **Risk**: Closing rate may not exist for the chosen date if BCRD scrape failed.
  **Mitigation**: Hook already falls back to most recent prior date. Manual override input remains available.

## Out of scope (future phases)
- Multi-entity side-by-side columns.
- Average-rate vs. closing-rate split for proper IFRS-style translation.
- Historical-rate tracking for equity accounts.
