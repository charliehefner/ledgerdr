

## Fix Stale Cache Race Condition + Correct Revolver Stock

### Problem
Three locations in `OperationsLogView.tsx` read inventory stock from the React Query cache (`inventoryItems?.find(...)`) instead of the database. When multiple operations are saved before the cache refreshes, stock deductions compound against stale values.

**Revolver**: 100 purchased - 50.4 used = should be **49.6**, but shows **43.6** (6.0 drift from bug).

### Changes

**1. `src/components/operations/OperationsLogView.tsx`** — 3 fixes:

| Location | Lines | Current (stale cache) | Fix (fresh DB fetch) |
|----------|-------|-----------------------|----------------------|
| Create mutation – deduct | 484-496 | `inventoryItems?.find(...)` | Fetch fresh `current_quantity` from DB via `.select().eq().maybeSingle()` |
| Update mutation – restore | 553-565 | `inventoryItems?.find(...)` | Same fresh DB fetch |
| Delete mutation – restore | 640-651 | `inventoryItems?.find(...)` | Same fresh DB fetch |

Each fix replaces the cache lookup with:
```typescript
const { data: freshItem } = await supabase
  .from("inventory_items")
  .select("current_quantity")
  .eq("id", input.inventory_item_id)
  .maybeSingle();
if (!freshItem) continue;
const newQuantity = freshItem.current_quantity +/- input.quantity_used;
```

This matches the pattern already used in the update mutation's deduction phase (lines 591-600).

**2. Correct Revolver stock** — Use the data insert tool to run:
```sql
UPDATE inventory_items SET current_quantity = 49.6 WHERE id = '6af42f2d-...'
```

I can make both the code fix and the data correction — no manual adjustment needed from you.

