

# Multi-Currency Separation in AP/AR (Payables & Receivables)

## Problem
The aging summary and totals in the AP/AR view sum all document balances regardless of currency. A USD $1,000 payable and a DOP $1,000 payable are added together as $2,000, which is meaningless.

## Solution
Split the aging summary and table by currency, and add a consolidated DOP-equivalent total using the latest exchange rate.

## Changes

### 1. `src/components/accounting/ApArDocumentList.tsx`

**Aging summary — currency-aware buckets:**
- Compute aging buckets per currency (DOP, USD, EUR separately)
- Show a row of aging cards per currency
- Add a "Total RD$ Equivalente" row that converts foreign currencies using the latest exchange rate

**Fetch exchange rate:**
- Add a query to fetch the latest USD_DOP and EUR_DOP sell rates from `exchange_rates` table (already used elsewhere in the system)

**Table grouping:**
- Add a currency filter (All / DOP / USD / EUR) to the toolbar so users can focus on one currency
- Show a currency badge on each row for clarity

**Totals row:**
- Add a table footer showing subtotals per visible currency and a DOP-equivalent grand total

### 2. No database changes needed
All data (currency field, exchange rates) already exists.

## Technical Details

- Reuse the existing `exchange_rates` table query pattern (seen in `PaymentDialog.tsx` and elsewhere)
- The aging `useMemo` will return `Record<string, AgingBuckets>` keyed by currency
- DOP equivalent calculation: `amount * sell_rate` for USD/EUR, `amount * 1` for DOP
- `formatCurrency` already handles currency symbols correctly

## Files Modified
| File | Change |
|------|--------|
| `src/components/accounting/ApArDocumentList.tsx` | Add exchange rate query, per-currency aging, currency filter, DOP-equivalent totals |

