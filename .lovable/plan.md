

## Auto-Fetch Exchange Rate from BCRD for Accounting Reports

### Problem
The P&L, Balance Sheet, and Cash Flow views all hardcode the exchange rate to `60 DOP/USD`. It should instead pull the official BCRD rate from the `exchange_rates` table based on the report's date, while remaining editable for manual override.

### Approach
Create a shared custom hook `useExchangeRate` that queries the `exchange_rates` table for the closest rate on or before a given date. Each report view will call this hook with its relevant date (end date for P&L/Cash Flow, as-of date for Balance Sheet). When the rate loads, it auto-populates the exchange rate field. The user can still manually edit the value.

### Changes

**1. New hook: `src/hooks/useExchangeRate.ts`**
- Accepts a `date` string parameter
- Queries `exchange_rates` table: `SELECT sell_rate FROM exchange_rates WHERE rate_date <= date AND currency_pair = 'USD/DOP' ORDER BY rate_date DESC LIMIT 1`
- Returns `{ rate: number | null, isLoading: boolean }`
- Uses React Query with the date as cache key

**2. `src/components/accounting/ProfitLossView.tsx`**
- Import and call `useExchangeRate(endDate)`
- On successful fetch, update `exchangeRate` state via `useEffect` (only when the fetched rate changes and user hasn't manually edited)
- The existing `Input` field for exchange rate remains fully editable

**3. `src/components/accounting/BalanceSheetView.tsx`**
- Same pattern using `useExchangeRate(asOfDate)`

**4. `src/components/accounting/CashFlowView.tsx`**
- Same pattern using `useExchangeRate(endDate)`

### Technical Detail
- The `exchange_rates` table already exists and is populated daily by the `fetch-exchange-rate` edge function
- Uses `sell_rate` (Venta) as the conversion rate, which is standard for financial reporting
- Falls back to the current hardcoded `60` if no rate is found in the database
- A small loading indicator appears next to the rate field while fetching

### Risk
- Zero schema changes — read-only query against existing table
- The field stays editable so the user retains full control
- If no rate exists for the date, the default `60` is used (same as today)

