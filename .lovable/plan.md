

## Add Transaction History Icon to CRM Contact List

### What
Add a clickable icon (e.g. `History`) on each contact row that opens a popover/dialog showing the last 10 transactions matching that contact (by RNC or name), displaying date, amount, and NCF attachment status.

### How

**`src/pages/Contacts.tsx`**
1. Add a `History` icon button in the actions cell (next to the delete button)
2. Clicking it sets state `historyContactId` to open a small `Dialog` with a table
3. Query `transactions` table filtered by:
   - `rnc = contact.rnc` (when RNC exists) **OR** `name ILIKE contact.name`
   - `is_void = false`
   - Order by `transaction_date DESC`, limit 10
4. For each transaction, check if an NCF attachment exists via `transaction_attachments` where `category = 'ncf'`
5. Display columns: Date, Amount (formatted with currency), NCF (checkmark or dash)

### Query logic
```typescript
// When history icon clicked, fetch on demand
const fetchHistory = async (contact: Contact) => {
  let query = supabase
    .from('transactions')
    .select('id, transaction_date, amount, currency, document')
    .eq('is_void', false)
    .order('transaction_date', { ascending: false })
    .limit(10);

  if (contact.rnc) {
    query = query.eq('rnc', contact.rnc);
  } else {
    query = query.ilike('name', contact.name);
  }
  // Then fetch attachment status for those transaction IDs
};
```

### UI
- `History` icon from lucide-react in the actions cell
- Opens a `Dialog` with contact name as title
- Simple table: Fecha | Monto | NCF (✓/—)
- Stops click propagation so it doesn't trigger row edit

### Files changed
| File | Change |
|------|--------|
| `src/pages/Contacts.tsx` | Add History icon, dialog, and on-demand query |

