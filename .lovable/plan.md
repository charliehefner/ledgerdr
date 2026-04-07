

## Problem

When an operation is saved, a database trigger updates the tractor's `current_hour_meter` in `fuel_equipment`. The backend data is correct (Pala Volvo shows 553 in the database). However, the **frontend never re-fetches the tractor data** after saving/editing/deleting an operation, so the Equipment tab keeps showing the stale cached value (550).

## Root cause

In `OperationsLogView.tsx`, the three mutation `onSuccess` handlers (create, update, delete) invalidate `["operations"]` and `["inventoryItems"]` but do not invalidate `["tractors"]` or `["tractors-for-horometer"]`.

## Fix

Add cache invalidation for tractor-related queries after every operation mutation:

**File: `src/components/operations/OperationsLogView.tsx`**

Add these two invalidation calls to all three mutation `onSuccess` blocks (create ~line 526, update ~line 638, delete ~line 700):

```typescript
queryClient.invalidateQueries({ queryKey: ["tractors"] });
queryClient.invalidateQueries({ queryKey: ["tractors-for-horometer"] });
```

This ensures that after any operation is created, edited, or deleted, the tractor list and hour-meter sequence views will re-fetch and display the updated `current_hour_meter` value from the database.

## Scope

- Single file change: `src/components/operations/OperationsLogView.tsx`
- Three insertion points (one per mutation's `onSuccess`)
- No backend or schema changes needed — the trigger already works correctly

