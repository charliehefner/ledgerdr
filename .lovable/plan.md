

# Duplicate Operation Detection with Override

## Problem
The Operations Log allows saving identical operations (same field, same operation type, same date, same inputs) without any warning, leading to accidental duplicates.

## Solution
Add a client-side duplicate check before inserting a new operation. When a potential duplicate is detected, show a confirmation dialog allowing the user to override and save anyway.

## Detection Criteria
An operation is a **potential duplicate** when an existing record matches ALL of:
- Same `field_id`
- Same `operation_type_id`  
- Same `operation_date`
- Same set of `inventory_item_id` values in inputs (order-independent)

## Changes — `src/components/operations/OperationsLogView.tsx`

1. **Before insert**, query `operations` + `operation_inputs` for the same date/field/operation_type
2. **Compare input sets**: if the existing operation's input item IDs match the current ones, flag as duplicate
3. **Show a confirmation dialog** (using existing `AlertDialog` pattern already in file) with message like:  
   *"An identical operation was already recorded for this field on this date. Save anyway?"*
4. If user confirms → proceed with insert as normal
5. If user cancels → return to form without saving

### Implementation detail
- Add state: `pendingDuplicate` (holds the form data when a duplicate is detected)
- In `mutation.mutationFn`, move the duplicate check to a pre-save function
- On duplicate detected: set `pendingDuplicate` and open confirmation dialog
- On confirm: call mutation with a `skipDuplicateCheck` flag
- Reuse existing `AlertDialog` imports already in the file

## Scope
| File | Change |
|------|--------|
| `src/components/operations/OperationsLogView.tsx` | Add duplicate detection query before insert, add confirmation dialog, add override state |

No database changes needed — this is a client-side UX guard.

