

## Fix: Purchase Totals Table + Fuel Stock Update

### Problem 1: Purchase Totals table reads wrong data source
The `PurchaseTotalsByAccount` component fetches from `fetchRecentTransactions()` which queries the `transactions` table. But purchases entered via the Purchase Dialog write to `inventory_purchases` — a completely separate table. The summary table never sees inventory purchases.

### Problem 2: Fuel purchases skip inventory stock update
In `PurchaseDialog.tsx`, the `inventory_items.current_quantity` update is inside an `else` block (line 158) that only runs for non-fuel items. Fuel purchases update the tank but never update inventory stock.

---

### Plan

**1. Rewrite `PurchaseTotalsByAccount.tsx` to query `inventory_purchases`**

Instead of fetching from `transactions`, query `inventory_purchases` joined with `inventory_items` to get CBS/account codes. This is the correct data source for purchase totals.

- Query `inventory_purchases` with a join to `inventory_items` (to get account/CBS info from the item)
- Filter by date range and entity
- Group totals by the same account/CBS pairs
- The component will need the item's associated account code — I'll check if `inventory_items` has a direct link or if we need to map by item function/category

**2. Fix fuel stock update in `PurchaseDialog.tsx`**

Move the `inventory_items.current_quantity` update **outside** the if/else block so it runs for ALL items (fuel and non-fuel). The fuel-specific tank operations remain inside the `if` block.

```
// New flow:
1. Insert purchase record (all items)
2. If fuel → insert fuel_transaction refill + optional gauge reset
3. Update inventory_items.current_quantity (ALL items)
```

**3. Add query invalidation for purchase totals**

Add `queryClient.invalidateQueries({ queryKey: ["inventoryPurchases"] })` or whatever key the new component uses, so the table refreshes after a purchase is recorded.

---

### Scope

| Component | Change |
|-----------|--------|
| `PurchaseTotalsByAccount.tsx` | Rewrite to query `inventory_purchases` instead of `transactions` |
| `PurchaseDialog.tsx` | Move stock update outside else block; runs for all items |

