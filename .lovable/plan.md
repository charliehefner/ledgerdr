

## Plan: Fix Duplicate Detection — Use NCF Only

### Problem
The duplicate check currently matches on **date + account + amount + name**, which flags legitimate transactions from the same vendor with the same amount on the same day (e.g., two Shell gasoline purchases of $800 with different NCF numbers).

### Solution
Change the duplicate detection to match on **NCF (`document` field) only**. The NCF is the true unique identifier for Dominican fiscal documents — no two legitimate transactions should share the same NCF.

### Changes (single file: `src/components/transactions/TransactionForm.tsx`)

Replace the `checkForDuplicate` function (~lines 192–216):

```typescript
const checkForDuplicate = () => {
  const doc = (form.document || '').trim();
  // No document entered — nothing to check
  if (!doc) return false;
  // Skip duplicate check for Nomina (payroll) transactions
  if (form.description.toLowerCase().includes('nomina')) return false;
  
  return existingTransactions.some(tx => {
    const txDoc = (tx.document || '').trim();
    return txDoc === doc;
  });
};
```

This means:
- If no NCF is entered, no duplicate warning fires
- If the same NCF exists in recent transactions, it flags it
- Same vendor + same amount + same date but different NCF passes through fine

No database or backend changes needed.

