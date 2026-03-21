

## Plan: Sync Transaction Edits to Existing AP/AR Documents

### Problem

When editing a transaction that already has a linked AP/AR document, the `EditTransactionDialog` only checks if a document exists and skips it. It never updates the existing document with the new contact name, RNC, amount, currency, or due date. It also doesn't invalidate the `ap-ar-documents` query cache.

### Fix

In `src/components/invoices/EditTransactionDialog.tsx`, inside the AP/AR sync block (around line 296):

**When `existingDoc` is found**, update it with the current transaction values:
- `contact_name`
- `contact_rnc`
- `total_amount` → recalculate `balance_remaining` = new total - amount_paid
- `currency`
- `due_date`
- `document_date`

**After saving**, add `ap-ar-documents` to the query invalidation list (after line 352).

### Technical Details

```tsx
// When existingDoc IS found (new else branch at line 296):
if (!existingDoc) {
  // ... existing insert logic ...
} else {
  // Sync updated fields to existing AP/AR document
  const txAmount = updates.amount !== undefined ? updates.amount : parseFloat(formData.amount);
  const txCurrency = updates.currency || formData.currency || 'DOP';
  const txDate = updates.transaction_date || formData.transaction_date;
  
  // Fetch current amount_paid to recalculate balance
  const { data: fullDoc } = await supabase
    .from('ap_ar_documents')
    .select('amount_paid')
    .eq('id', existingDoc.id)
    .single();
  
  const amountPaid = fullDoc?.amount_paid || 0;
  
  await supabase.from('ap_ar_documents').update({
    contact_name: updates.name || formData.name || undefined,
    contact_rnc: updates.rnc !== undefined ? updates.rnc : undefined,
    total_amount: txAmount,
    balance_remaining: Math.max(0, txAmount - amountPaid),
    currency: txCurrency,
    due_date: effectiveDueDate || txDate,
    document_date: txDate,
  }).eq('id', existingDoc.id);
}
```

Add cache invalidation:
```tsx
queryClient.invalidateQueries({ queryKey: ["ap-ar-documents"] });
```

### Files Changed

| File | Change |
|------|--------|
| `src/components/invoices/EditTransactionDialog.tsx` | Add update logic for existing AP/AR docs + invalidate cache |

