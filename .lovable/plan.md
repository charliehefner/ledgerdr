

## Fix: Missing entity_id on Operation Insert

### Problem
Creating a new operation fails with: `null value in column "entity_id" of relation "operations" violates not-null constraint`. The insert record in the create mutation (line 435) does not include `entity_id`.

### Root Cause
The `selectedEntityId` is available from `useEntityFilter()` (line 118), but it's never added to the insert payload.

### Fix

**File: `src/components/operations/OperationsLogView.tsx`**

Add `entity_id: selectedEntityId` to the `record` object in the **create mutation** (around line 435):

```typescript
const record = {
  entity_id: selectedEntityId,   // <-- add this
  operation_date: formatDateLocal(data.operation_date),
  field_id: data.field_id,
  // ... rest unchanged
};
```

The update mutation (line 558) does not need this since `entity_id` doesn't change on update.

### Scope
- Single file change: `src/components/operations/OperationsLogView.tsx`
- One line addition in the create mutation's record object

### Verification Needed
After this fix, creating a new operation should succeed, and the hour meter should update immediately in the Equipment tab (testing both the trigger fix and the cache invalidation fix together).

