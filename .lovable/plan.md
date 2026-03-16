

# Fix: Generic Error Message on Transaction Save

## Problem
When saving an internal transaction fails, the user sees a generic "Error" toast with no details. The catch block in `TransactionForm.tsx` (line 336-339) discards the actual error message:

```typescript
} catch (error) {
  toast.error(t('txForm.error'));  // Generic message, ignores actual error
  console.error(error);
}
```

The `createTransaction` function in `api.ts` correctly throws with the database error message (`throw new Error(error.message)`), but the form never displays it.

## Root Cause
No database errors appear in recent logs, which means either:
1. The error was transient (network/connectivity - the logs show "Failed to fetch" errors from around the same time)
2. A trigger rejection (locked period, ITBIS cap) whose message was swallowed

Either way, the fix is the same: **show the actual error message to the user**.

## Plan

### 1. Show actual error message in TransactionForm.tsx
Update the catch block to append the real error message:
```typescript
} catch (error) {
  const msg = error instanceof Error ? error.message : '';
  toast.error(msg || t('txForm.error'));
  console.error(error);
}
```

### 2. Same fix in EditTransactionDialog.tsx
Apply the same pattern to the edit dialog's error handler so users see the specific database rejection reason there too.

**Files**: `src/components/transactions/TransactionForm.tsx`, `src/components/invoices/EditTransactionDialog.tsx`

