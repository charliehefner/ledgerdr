

# Fix: Smarter Autocomplete Deduplication (Keep Both Sources)

## Problem
Legacy transaction names still appear alongside cleaned CRM contacts, causing duplicates. But removing legacy names entirely would lose suggestions for vendors not yet in CRM, leading to new inconsistencies.

## Solution
Keep both sources, but suppress legacy names that are already represented by a CRM contact.

## Changes — `src/components/transactions/NameAutocomplete.tsx`

1. **Build a case-insensitive Set of CRM contact names** for fast lookup
2. **Filter legacy `suggestions`**: only include a legacy name if no CRM contact matches it case-insensitively
3. **CRM contacts appear first** in the merged list (they're canonical), followed by remaining legacy names
4. This way:
   - Cleaned CRM contacts always win over old variations
   - Vendors not yet in CRM still appear as suggestions from transaction history
   - No data loss, no new duplicate risk

## Files Modified
| File | Change |
|------|--------|
| `src/components/transactions/NameAutocomplete.tsx` | Case-insensitive dedup of legacy suggestions against CRM contacts; CRM contacts sorted first |

No changes needed in `TransactionForm.tsx` — keep passing `suggestions` as-is.

