
## Diagnosis: USD Credit Card Missing — Plus Treasury Currency Visibility

### What I found

**1. Transactions only shows DOP cards** — Confirmed by querying `bank_accounts`:
| Card | Last 4 | Currency | GL |
|---|---|---|---|
| Credit Card Agri | 4844 | DOP | (Agri) |
| Credit Card Industry | 3280 | DOP | (Industry) |
| Credit Card Management | 3746 | **DOP** | 2441 |

There is **no USD card** in the database. The TransactionForm shows whatever exists in `bank_accounts` with `account_type='credit_card'` and `is_active=true` — no currency filter is applied. So the form is working correctly; the USD card just hasn't been created yet.

**2. Treasury credit cards "no reference to currency"** — The `CreditCardsList.tsx` table actually does have a "Moneda / Currency" column (renders `acct.currency`). But since all 3 existing cards are DOP, the column looks redundant. Once a USD card is added, the column will visibly differentiate them.

GL account `2444` (Accounts payable - Business Credit Card-3746 US$) exists and is ready to use.

### Proposed fix (2 parts)

**Part A — Insert the missing USD credit card record** (data, not schema)

Insert a new row into `bank_accounts`:
- `account_name`: "Credit Card Management USD"
- `bank_name`: "Banco BDI"
- `account_number`: "3746"
- `currency`: "USD"
- `account_type`: "credit_card"
- `chart_account_id`: `cf5b5584-a92e-4b00-ab4d-214906081488` (account 2444)
- `entity_id`: `30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf` (Management entity, same as the DOP card)
- `is_active`: true

After insert, the card will immediately appear in:
- Treasury → Tarjetas de Crédito (with "USD" in the currency column)
- Transactions → Pay Method dropdown (labeled "Credit Card Management USD (USD)")
- Transfer To/From dropdowns

**Part B — Make currency more visible in Treasury Credit Cards list** (small UX polish)

In `src/components/accounting/CreditCardsList.tsx`, append the currency to the card name itself in the first column (e.g. "Credit Card Management · USD") so the currency is impossible to miss at a glance, in addition to the dedicated column. Also style the currency column with a subtle badge for non-DOP currencies.

### Files changed
- DB insert (one row in `bank_accounts`) — via insert tool
- `src/components/accounting/CreditCardsList.tsx` — small visual tweak to surface currency

### Risk
Very low. New isolated row + a cosmetic UI change. No schema, no logic changes.
