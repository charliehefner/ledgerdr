

## Add Day Comment Buttons to Payroll Time Grid

### What It Does
Adds a tiny dot-sized button in the corner of each day cell in the Hoja de Tiempo. Clicking it opens a small popover for entering/viewing a note for that employee on that day.

### Visual Design
- A small circular dot (8x8px) positioned in the top-right corner of each day cell
- **Green dot** = no comment (or empty)
- **Red dot** = comment exists
- Clicking the dot opens a Popover with a small textarea (3 rows) and a Save button
- Minimal footprint -- does not affect existing cell layout

### Technical Details

**No database migration needed** -- the `employee_timesheets` table already has a `notes` column (nullable text).

**File: `src/components/hr/PayrollTimeGrid.tsx`**

1. Import `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover` and `Textarea` from `@/components/ui/textarea`.
2. Add the `notes` field to the `TimesheetEntry` interface.
3. Include `notes` in the upsert mutation so notes are saved alongside time entries.
4. Create a small `NoteButton` inline component that:
   - Renders an 8x8 colored dot (green if no note, red if note exists) absolutely positioned in top-right of cell
   - On click, opens a Popover with a Textarea pre-filled with existing note
   - Has a small "Guardar" button to save
   - Saves by upserting the timesheet entry with the updated `notes` field
5. Place the `NoteButton` inside each day cell `<td>`, visible for all days (including Sundays).

### User Experience
- Dots are unobtrusive and don't interfere with time entry
- Hover shows cursor pointer
- Red dots make it instantly obvious which days have notes
- Notes persist per employee per day

