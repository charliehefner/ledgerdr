

# Make "New Document" Button Less Prominent in AP/AR

## Change

In `ApArDocumentList.tsx` line 201-203, change the button from the default primary variant to `variant="outline"` and `size="sm"` (already sm). This keeps the functionality accessible but visually secondary, reinforcing that documents should primarily come from Transactions.

| File | Line | Change |
|------|------|--------|
| `ApArDocumentList.tsx` | 201 | Add `variant="outline"` to the Button |

