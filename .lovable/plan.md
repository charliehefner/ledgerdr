

## Problem

The `cronograma_entries` table has a foreign key constraint referencing `cronograma_weeks(week_ending_date)`. When a user tries to save a schedule entry for a week that doesn't yet have a row in `cronograma_weeks`, the insert fails with a foreign key violation.

The code only creates `cronograma_weeks` rows during the "Close Week" action (line 332-335 of CronogramaGrid.tsx), but never when saving individual entries.

Both Ronny and cedenojord have the correct `supervisor` role and proper RLS policies — the issue is purely the missing FK parent row.

## Fix

**File: `src/components/cronograma/CronogramaGrid.tsx`**

In the save mutation (`mutationFn`, around line 276), add an upsert to `cronograma_weeks` **before** inserting/updating `cronograma_entries`:

```typescript
// Ensure week row exists (upsert)
const { error: weekError } = await supabase
  .from("cronograma_weeks")
  .upsert(
    { week_ending_date: entry.week_ending_date, is_closed: false },
    { onConflict: "week_ending_date", ignoreDuplicates: true }
  );
if (weekError) throw weekError;
```

This single line ensures the parent `cronograma_weeks` row exists before any entry insert, using `ignoreDuplicates` so it won't overwrite an existing week's `is_closed` status.

## Impact
- Fixes the FK violation for all users (not just supervisors)
- No schema changes needed
- No RLS changes needed — supervisors already have INSERT on `cronograma_weeks`

