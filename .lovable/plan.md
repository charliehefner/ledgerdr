

## Plan: Repurpose Unused Accounts and Add Missing ADM Accounts

### Summary
Update 10 existing account descriptions to match ADM Cloud usage, and insert ~43 new accounts that ADM actively uses but are missing from the database.

### Part 1: Repurpose Existing Accounts (UPDATE via insert tool)

| Code | Current Description | ADM Description | Notes |
|------|-------------------|-----------------|-------|
| 1020 | Concessions | Cuentas por Pagar a Accionistas Charles Hefner | Also change type ASSET→LIABILITY |
| 1258 | Accumulated write-downs of computers | Advance to Suppliers USD | |
| 1259 | Accumulated amortization of computers | Advance to Suppliers DOP | |
| 1299 | Accum. amort. other tangible assets | Depreciación Acum. de Mobiliarios y Equipos Sin NCF | |
| 1510 | Accounts receivebles | Accounts receivebles USD | Add currency context |
| 1670 | Short-term receivables affiliated co. | Short-term receivables affiliated co. -Charles Hefner | |
| 2441 | Exchange rate adj. accounts payable | Accounts Payable -Business Credit Card-3746 | |
| 2470 | Accounts payables, affiliated co. | Accounts payables, affiliated companies DOP | |
| 2820 | Current liabilities to employees | Current liabilities to employees (SRL) to pay | |
| 2890 | Other current liabilities | Other current liabilities (N07-07) | |

All 10 were confirmed to have **zero transactions** in the previous analysis.

### Part 2: Add Missing ADM Accounts (INSERT via insert tool)

**Header accounts** (allow_posting = false):
1000, 1100, 1200, 1500, 2000, 3400, 3600, 5600, 6000

**Posting accounts** (~34 accounts) including:
- Assets: 1211, 1213, 1632, 1641, 1642, 1643, 1801, 1802, 1947
- Liabilities: 2101, 2291, 2292, 2361, 2442, 2443, 2444, 2445, 2446, 2447, 2741, 2891
- Equity: 8900, 8998
- Income: 3421
- Cost: 7514, 8011, 8013, 8017
- Expense: 5801, 5802, 5803, 8331, 8431, 781000

Each account will use the ADM descriptions (English + Spanish) and appropriate `account_type` mapping.

### What Won't Change
- Bank accounts (1931–1936 vs 1940–1948) — deferred to a separate migration
- Credit card accounts 2851–2853 — kept as-is alongside new ADM credit card accounts
- No schema changes needed — data-only operations
- No code changes needed — all accounts use the same `chart_of_accounts` table structure

### Risk Assessment
- **Repurposing**: Zero risk (all confirmed dormant)
- **Adding**: Zero risk (purely additive, no conflicts)

