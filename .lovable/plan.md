

# Fix: "Credit" Payment Method Should Auto-Create AP/AR Document

## Problem

When a user selects "Credit" (Crédito) as the payment method, it means the purchase was not paid — it's owed. This should automatically create an Accounts Payable document. Currently, AP/AR auto-creation only triggers when `due_date` is explicitly filled in.

A user entering a purchase on credit reasonably expects it to appear in AP without having to also remember to set a due date.

## Fix

### TransactionForm.tsx — Expand AP/AR auto-creation trigger

Currently (line 307):
```typescript
if (form.due_date && !isTransfer && form.transaction_direction !== 'payment')
```

Change to also trigger when `pay_method === 'credit'`:
```typescript
const shouldCreateApAr = !isTransfer && form.transaction_direction !== 'payment'
  && (form.due_date || form.pay_method === 'credit');
```

When `pay_method === 'credit'` but no `due_date` is set, use a sensible default (e.g., 30 days from transaction date) as the `due_date` on the AP/AR document, so the aging report works correctly.

The `direction` logic stays the same: purchases → payable, sales → receivable.

### One file changed

| File | Change |
|------|--------|
| `TransactionForm.tsx` | Expand AP/AR creation condition to include `pay_method === 'credit'`; default due_date to +30 days when missing |

This is a small, surgical fix — no schema changes needed.

