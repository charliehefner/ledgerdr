

## Fix: Pass `entity_id` Explicitly in All Inventory Inserts

### Problem
When a global admin is in "All Entities" mode (or `current_user_entity_id()` returns NULL for any reason), inserts into `inventory_purchases`, `fuel_transactions`, and `inventory_items` fail because `entity_id` is NOT NULL but the default function returns NULL. The PurchaseDialog and InventoryItemDialog never pass `entity_id` explicitly.

### Solution
Import `useEntity` in both dialogs, call `requireEntity()` before insert, and pass the `entity_id` in every insert payload. If no entity is selected, show an error toast and block the save.

### Changes

**`src/components/inventory/PurchaseDialog.tsx`**
1. Import `useEntity` from `@/contexts/EntityContext`
2. Call `requireEntity()` at the start of `handleSubmit` — if null, toast error and return
3. Pass `entity_id` in the `inventory_purchases` insert (line 112)
4. Pass `entity_id` in the `fuel_transactions` insert (line 141)

**`src/components/inventory/InventoryItemDialog.tsx`**
1. Import `useEntity` from `@/contexts/EntityContext`
2. Call `requireEntity()` before mutation — if null, toast error and return
3. Pass `entity_id` in the `inventory_items` insert (line 127)

Both files follow the same pattern already used in `PhysicalCountView.tsx`. Two files, ~10 lines each.

