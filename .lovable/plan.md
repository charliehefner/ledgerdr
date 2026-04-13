

## Fix: Allow Editing Estimated Tons on Existing Plant Hours Records

### Problem
The Plant Hours table only supports adding new records and deleting them. There is no way to edit an existing row — so once a record is saved, the estimated_tons value (or any other field) cannot be changed.

### Solution
Add inline edit capability to the Plant Hours table. Clicking a row (or an edit button) opens the same form pre-filled with that row's data, allowing updates.

### Changes

**`src/components/industrial/PlantHoursView.tsx`**
- Add an `editingRow` state to track which record is being edited
- Add an update mutation that calls `supabase.from("industrial_plant_hours").update(...)` 
- Add a pencil/edit icon button next to each row's delete button
- When editing, open the same dialog pre-filled with that row's values
- On save, call update instead of insert; reset editing state on close
- The dialog title changes to "Edit" vs "New" depending on mode

This is a single-file change. All five fields (date, start meter, finish meter, estimated tons, notes) become editable on existing records.

