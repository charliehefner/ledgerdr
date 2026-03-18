

# Credit Card Transaction Detail View

## Problem
The Treasury "Tarjetas de Crédito" tab only shows a summary table with GL balances. There is no way to see individual transactions registered against each credit card.

## Approach
Add an expandable/drilldown transaction list per credit card. When a user clicks a credit card row (or a "Ver" button), a dialog or expandable section shows all transactions where `pay_method = creditCard.id` OR `destination_acct_code = creditCard.id` (for transfers/payments to the card).

## Data Source
Transactions are linked to credit cards via the `pay_method` column in the `transactions` table, which stores the `bank_accounts.id` UUID. This means we query **raw transactions** directly — not journal lines — so both posted and unposted transactions appear.

## Implementation

### 1. Add transaction detail dialog to CreditCardsList
- Add a new state `selectedCardId` to track which card's transactions to show
- Add a "Ver movimientos" icon button per row
- Open a Dialog showing transactions filtered by `pay_method = selectedCardId` OR `destination_acct_code = selectedCardId`
- Query: `supabase.from("transactions").select("id, legacy_id, transaction_date, description, amount, currency, name, is_void, pay_method, destination_acct_code").or("pay_method.eq.{id},destination_acct_code.eq.{id}").eq("is_void", false).order("transaction_date", { ascending: false })`

### 2. Transaction list columns
- Fecha, Descripción, Nombre, Monto, Moneda, Estado (void badge)
- Show whether the transaction is a charge (pay_method = card) or a payment to the card (destination = card)
- Running balance not needed since this is a simple transaction log

### 3. No database changes required
All data already exists in the `transactions` table with the correct `pay_method` linkage.

