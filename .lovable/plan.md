

# Fix: Exchange Rate Query Uses Wrong Currency Pair Format

## Root Cause
The `exchange_rates` table stores currency pairs as `USD/DOP` (with a slash), but the code in `ApArDocumentList.tsx` queries for `USD_DOP` (with an underscore). The query returns no results, so the fallback rate of `1` is used — making USD amounts appear equal to DOP.

The same bug exists in `AgingReportView.tsx`.

## Fix

### `src/components/accounting/ApArDocumentList.tsx` (line 148)
Change the query pairs from `["USD_DOP", "EUR_DOP"]` to `["USD/DOP", "EUR/DOP"]`, and update the currency key extraction to split on `"/"` instead of `"_"`.

### `src/components/accounting/AgingReportView.tsx`
This file has no exchange rate query currently — it groups by currency in its totals row but doesn't convert. Add a DOP-equivalent grand total row using the same exchange rate query pattern (with the correct `USD/DOP` format).

## Scope
- 2 files changed
- No database changes

