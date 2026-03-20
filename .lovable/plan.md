

# Fix: Repair Old AP Documents Still Linked to Account 2110

## Status of Previous Fix
- ✅ **Code fix confirmed**: Both `TransactionForm.tsx` (line 344) and `ApArDocumentList.tsx` (line 79) now use prefix `'24'` for payables
- ✅ **New AP auto-creation works**: Credit purchases will correctly link to `2440`
- ✅ **Transaction 361**: Already shows `2440` (was repaired in the previous migration)
- ❌ **Old documents 349, 253, 254, etc.**: Still show `2110` — created before the fix

## Plan

### 1. Data repair migration
Update all existing `ap_ar_documents` where `direction = 'payable'` and `account_id` points to a `21xx` account, reassigning them to the first postable `24xx` account (2440 - Cuentas a pagar).

```sql
UPDATE ap_ar_documents
SET account_id = (
  SELECT id FROM chart_of_accounts
  WHERE account_code LIKE '24%'
    AND allow_posting = true
    AND deleted_at IS NULL
  ORDER BY account_code LIMIT 1
)
WHERE direction = 'payable'
  AND account_id IN (
    SELECT id FROM chart_of_accounts
    WHERE account_code LIKE '21%'
  );
```

### Files Modified
- New migration only — no code changes needed

