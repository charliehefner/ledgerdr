

## Analysis: Same-Day Hour Meter Gap False Positive

### Root Cause
The `checkHourMeterGap` function in `src/components/operations/utils.ts` (line 59) filters previous operations using a **strict less-than** date comparison:

```typescript
.filter(op => {
  const opDate = parseDateLocal(op.operation_date);
  return opDate < operationDate;  // ← excludes same-day operations
})
```

When Ronny enters the **second** operation on the same day, the first operation is excluded from the comparison because its date is **equal**, not **less than**. The gap check then compares against the previous *day's* last operation, triggering a false gap warning.

Additionally, the `operations` list used by this check comes from React Query cache. After saving the first operation, the list IS invalidated and refetched (the save mutation calls `invalidateQueries`), so the data is fresh. The bug is purely the date filter.

### Fix (single file: `src/components/operations/utils.ts`)

Change the date comparison from `<` to `<=` so same-day operations are included:

```typescript
return opDate < operationDate;
// becomes:
return opDate <= operationDate;
```

Then add an exclusion for the current operation's own ID (to avoid self-comparison when editing). This requires passing an optional `excludeId` parameter.

Alternatively, since the function already sorts by date descending and picks the most recent `end_hours`, simply changing `<` to `<=` is sufficient — it will correctly find the first operation's `end_hours` from the same day.

### Also: Auto-populate start_hours from tractor's current_hour_meter

As a UX improvement, when a tractor is selected, auto-fill the `start_hours` field with the tractor's `current_hour_meter` (which the DB trigger keeps up to date). This requires:

1. Invalidating the `["tractors"]` query after saving an operation (already done via operations invalidation, but we should explicitly add it)
2. Adding an `onChange` handler for the tractor dropdown that sets `start_hours` to the selected tractor's `current_hour_meter`

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/operations/utils.ts` | Change `opDate < operationDate` → `opDate <= operationDate` in `checkHourMeterGap`, and exclude current operation ID |
| `src/components/operations/OperationsLogView.tsx` | Auto-populate `start_hours` when tractor is selected; invalidate `["tractors"]` query after save |

### Answer to Ronny
No, he does **not** need to wait. This is a bug — the gap check ignores same-day operations. The fix will include same-day operations in the comparison and also auto-fill the start hours from the tractor's updated meter reading.

