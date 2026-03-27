

## Problem

Transaction 416 (AS Electricidad, credit, due 2026-04-27) correctly triggered the AP/AR auto-creation logic, but the insert **silently failed**. The reason: `balance_remaining` is a database-generated column (`total_amount - amount_paid`), and the code on line 388 tries to explicitly set it in the insert payload. Postgres rejects writes to generated columns, and the error is swallowed by the `catch` block.

## Fix

**File: `src/components/transactions/TransactionForm.tsx`** (lines 377-393)

1. **Remove `balance_remaining`** from the insert payload — the database computes it automatically.

2. **Surface the error to the user** — change the `catch` block to show a toast instead of silently logging.

```typescript
// Before (line 388):
balance_remaining: totalAmount,  // ← REMOVE this line

// After: just omit balance_remaining entirely
await supabase.from('ap_ar_documents').insert({
  direction,
  document_type: isAdvance ? 'advance' : 'invoice',
  contact_name: form.name || form.description,
  contact_rnc: form.rnc || null,
  document_number: result.legacy_id?.toString() || null,
  document_date: formatDateLocal(form.transaction_date!),
  due_date: isAdvance ? null : (dueDate || null),
  currency: form.currency,
  total_amount: totalAmount,
  amount_paid: 0,
  status: 'open',
  linked_transaction_ids: [result.id],
  notes: form.description,
  account_id: defaultAcct?.id || null,
} as any);
```

Also update the catch block (line 395-397) to warn the user:
```typescript
} catch (apArErr) {
  console.error('Auto AP/AR creation error:', apArErr);
  toast.error('Error creando documento CxP/CxC automático');
}
```

## Existing Transaction 416

After the code fix, transaction 416's AP/AR document still needs to be created. Options:
- Manually insert it via a one-time migration
- Or simply edit and re-save transaction 416 from the Edit dialog (which should also be checked for the same `balance_remaining` bug)

## Impact
- Fixes silent AP/AR creation failures for all future credit/due-date transactions
- No database changes needed
- One line removal + one toast addition

