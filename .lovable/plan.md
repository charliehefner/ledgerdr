

## Investigation Results: Two Separate Issues Found

### Issue 1: Pay Method column shows raw codes / UUIDs

In `RecentTransactions.tsx` line 169, `tx.pay_method` is rendered as-is:
```tsx
<TableCell>{tx.pay_method || "-"}</TableCell>
```

For standard methods this shows things like `transfer_bdi`, `petty_cash`, `cash` — raw internal codes instead of human-readable labels like "Transferencia BDI" or "Caja Chica".

For transfers, `pay_method` stores a **bank account UUID** (the source account), which renders as an unreadable UUID string.

**Fix**: Create a helper that maps known pay method codes to their i18n labels, and for UUIDs, looks up the bank account name. Fetch `bank_accounts` in the query and build a lookup map.

### Issue 2: Transfers TO Petty Cash don't appear in Treasury > Petty Cash

`PettyCashView.tsx` line 86 queries:
```sql
.eq("pay_method", "petty_cash")
```

This only catches transactions **paid from** petty cash. A transfer TO petty cash has:
- `transaction_direction = "payment"` (transfer)
- `pay_method` = source bank account UUID
- `destination_acct_code` = petty cash bank account UUID

So transfers TO petty cash are never shown.

**Fix**: Expand the petty cash transactions query to also include transfers where `destination_acct_code` matches a petty cash bank account ID. Use an `.or()` filter combining both conditions.

### Plan

**File 1: `src/components/transactions/RecentTransactions.tsx`**
- Fetch `bank_accounts` (id, account_name, account_type) via a new useQuery
- Create a `getPayMethodLabel(payMethod)` helper that:
  - Maps known codes (`transfer_bdi` → t("txForm.transferBdi"), `cash` → t("txForm.cash"), `petty_cash` → t("txForm.pettyCash"), etc.)
  - For UUIDs, looks up the bank account name from the fetched data
  - Falls back to the raw value if no match
- Replace line 169 with `getPayMethodLabel(tx.pay_method)`

**File 2: `src/components/accounting/PettyCashView.tsx`**
- Fetch petty cash bank account IDs from the existing `accounts` query
- Change the transactions query to use `.or()`:
  ```
  pay_method.eq.petty_cash, destination_acct_code.in.(petty_cash_ids)
  ```
- Add a "Tipo" (Type) column to distinguish between "Gasto" (expense from petty cash) and "Recarga" (transfer into petty cash)
- Adjust the total calculation to subtract recharges from expenses (or show them separately)

