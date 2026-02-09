
# Fix: Saturday Overtime Highlighting in Payroll Time Grid

## Problem
The overtime cell highlighting (amber/orange background) uses the weekday threshold of 16:30 (4:30 PM) for all days. On Saturdays, overtime begins after 11:30 AM, but the visual indicator doesn't reflect this. The hours are **calculated correctly** -- only the cell color is wrong.

## Root Cause
Line 815 in `PayrollTimeGrid.tsx`:
```
const hasOvertime = hasData && entry?.end_time && parseTimeToMinutes(entry.end_time) > STANDARD_END;
```
This compares against `STANDARD_END` (16:30) regardless of day type. Saturday overtime starts at `SATURDAY_NORMAL_END` (11:30).

## Fix
**File:** `src/components/hr/PayrollTimeGrid.tsx`

Update the `hasOvertime` calculation (around line 815) to check whether it's a Saturday and use the appropriate threshold:

```typescript
// Saturday: overtime if total hours > 4 (i.e., end time beyond 11:30 AM normal period)
// Weekday: overtime if end time > 16:30
const hasOvertime = hasData && entry?.end_time && (
  saturday
    ? parseTimeToMinutes(entry.end_time) > SATURDAY_NORMAL_END
    : parseTimeToMinutes(entry.end_time) > STANDARD_END
);
```

This is a one-line change. The `saturday` variable is already defined on line 805. No other files need modification.
