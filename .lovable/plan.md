
# Enhanced Schedule Change Highlighting

## Overview
This plan modifies the Schedule (Cronograma) highlighting rules to add a new category: changes made by **cedenojord** will be highlighted, but only if they occur **8 or more hours after the initial entry creation**. These late self-edits will be visually distinct from edits made by other users.

## New Highlighting Rules Summary

| Editor | Condition | Highlight Style |
|--------|-----------|-----------------|
| **instructor** | Never | No highlight |
| **cedenojord** | Within 8 hours of creation | No highlight |
| **cedenojord** | After 8 hours of creation | Blue highlight |
| **Anyone else** | Always | Orange highlight |

## What You Will See

- **Orange border + dot**: Changes by other users (current behavior)
- **Blue border + dot**: Changes by cedenojord made 8+ hours after initial writing
- **No highlight**: Changes by instructor, or cedenojord edits within 8 hours

The tooltip will continue to show who made the change and when.

---

## Technical Details

### Constants Update
Replace the single `EXCLUDED_EDITOR_IDS` array with specific constants:

```text
CEDENOJORD_ID = "3976a9b9-ac8e-4afb-a4cb-2efcc02c2e80"
INSTRUCTOR_ID = "7ce0dff1-c2b3-4506-b6eb-c61d9ca50121"
SELF_EDIT_HIGHLIGHT_HOURS = 8
```

### New Highlight Detection Logic
Create a function that returns the highlight type based on:
1. The `updated_by` user ID
2. The `created_at` timestamp
3. The `updated_at` timestamp

```text
function getHighlightType(entry):
  - If no updated_by -> no highlight
  - If updated_by is instructor -> no highlight
  - If updated_by is cedenojord:
      - Calculate hours between created_at and updated_at
      - If >= 8 hours -> "self-edit" (blue highlight)
      - Otherwise -> no highlight
  - If updated_by is anyone else -> "other" (orange highlight)
```

### Visual Styling Changes
Modify `CronogramaCell` to support two highlight types:

| Type | Ring Color | Dot Color |
|------|------------|-----------|
| `other` | `ring-orange-400` | `bg-orange-400` |
| `self-edit` | `ring-blue-400` | `bg-blue-400` |

### Data Requirements
The `CronogramaEntry` type already includes `created_at` - just need to ensure it's being fetched and passed to the cell component.

### Files to Modify
1. **src/components/cronograma/CronogramaGrid.tsx**
   - Add new constants for specific user IDs and time threshold
   - Create `getHighlightType()` function returning `null | "other" | "self-edit"`
   - Update `CronogramaCell` props to accept highlight type instead of boolean
   - Apply different ring/dot colors based on highlight type
   - Update tooltip to optionally indicate "late self-edit" vs "modified by other"
