

## Fix: Update Legacy Petty Cash Transactions

### Problem
Transactions 270–282 (and possibly others) use the legacy string `pay_method = 'petty_cash'` instead of the fund UUID. The Treasury petty cash view filters by UUID, so these transactions are invisible.

### Fix
Single data UPDATE via the insert tool — no code or schema changes needed:

```sql
UPDATE transactions
SET pay_method = '31227d8e-93c7-4ce7-99fc-99a91255ef5d'
WHERE pay_method = 'petty_cash'
  AND is_void = false;
```

This remaps all legacy `petty_cash` transactions to the **Caja Chica Finca** fund UUID, making them visible in Treasury.

### Scope
- Data-only fix, no file changes
- Will first count affected rows to confirm scope before updating

