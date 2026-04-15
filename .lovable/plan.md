

## Fix Revolver Stock + Prevent Future Race Conditions

### 1. Immediate data fix — Set Revolver to 6.6L

Use the insert tool to run:
```sql
UPDATE inventory_items SET current_quantity = 6.6 WHERE id = '6af42f2d-4fe1-4dfc-b2dd-6608500ac4db';
```

The P01 Pulverizar operation's inputs were lost — you'll need to tell me the Revolver quantity used in that operation so I can re-insert the input row (without further deducting stock, since 6.6 already accounts for all 93.4L used).

### 2. Database migration — Atomic `save_operation_inputs` function

Create a PL/pgSQL function that wraps the entire restore-delete-insert-deduct cycle in a single transaction:

```sql
save_operation_inputs(
  p_operation_id UUID,
  p_inputs JSONB,            -- [{inventory_item_id, quantity_used}, ...]
  p_restore_original BOOLEAN -- true for edit/delete, false for create
)
```

Steps inside one transaction:
- If restoring: fetch existing `operation_inputs`, add each `quantity_used` back to `inventory_items.current_quantity`
- Delete all `operation_inputs` for the operation
- Insert new rows from `p_inputs`
- Deduct each new quantity from `inventory_items.current_quantity`
- Any failure rolls back everything

### 3. Frontend changes — `OperationsLogView.tsx`

Replace the three multi-step mutation bodies (create, edit, delete) with single RPC calls to `save_operation_inputs`. This eliminates the race condition entirely.

| Component | Change |
|-----------|--------|
| Data fix | Set Revolver `current_quantity` to 6.6 |
| New migration | `save_operation_inputs()` function |
| OperationsLogView.tsx | Replace 3 mutation bodies with RPC calls |

