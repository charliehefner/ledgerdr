

## Fix: Entity ID Missing When Closing Payroll Period

### Root Cause
In `PayrollSummary.tsx` line 556, the `closePeriod` mutation calls `createTransaction(...)` for each employee's net pay but **never passes `entityId`** as the second argument. The `createTransaction` function in `api.ts` (line 229) only includes `entity_id` in the insert when `entityId` is truthy — so the column is omitted entirely, triggering the NOT NULL constraint on `transactions.entity_id`.

### Fix

**`src/components/hr/PayrollSummary.tsx`** — Pass `selectedEntityId` (already available via `useEntity()` on line 100) to every `createTransaction` call inside the `closePeriod` mutation:

```typescript
// Line 556: Change from
await createTransaction({ ... });
// To
await createTransaction({ ... }, selectedEntityId);
```

Additionally, add a guard at the top of the mutation to prevent closing when in "All Entities" mode (no entity selected):

```typescript
if (!selectedEntityId) {
  throw new Error("Seleccione una entidad específica para cerrar el período");
}
```

### Scope
| File | Change |
|------|--------|
| `PayrollSummary.tsx` | Pass `selectedEntityId` to `createTransaction`, add entity guard |

One-line fix + one safety guard. No database changes needed.
