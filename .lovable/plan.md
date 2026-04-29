# Fix "Error saving employee"

## Root cause

The database rejected the insert with:
> `null value in column "entity_id" of relation "employees" violates not-null constraint`

`EmployeeFormDialog` builds its insert payload without `entity_id`, while `employees` requires it (per the project's multi-entity scoping rule — every write must explicitly pass `entity_id`). Sibling views like `JornalerosView` already do this correctly via `requireEntity()` from `EntityContext`.

## Fix

Update `src/components/hr/EmployeeFormDialog.tsx`:

1. Import `useEntity` from `@/contexts/EntityContext`.
2. Call `const { requireEntity } = useEntity();` inside the component.
3. In `onSubmit`, before building the payload:
   - `const entityId = requireEntity();`
   - If `null`, return early (the helper already shows a toast asking the user to pick an entity — useful for global admins on "All Entities").
4. Include `entity_id: entityId` in the `payload` for the **insert** branch (new employee). For the **update** branch, leave the payload as-is — we shouldn't reassign an existing employee's entity from this dialog.

That's the only change needed; no schema or RLS changes.

## Why no other changes

- The other recent DB error in logs (`column "subscription_id" does not exist`) is unrelated to employee creation (different table/feature) and not part of this report.
- Update flow already works because existing rows have `entity_id` set; we only need to populate it on insert.

## Files

- `src/components/hr/EmployeeFormDialog.tsx` — add entity context + include `entity_id` in insert payload.
