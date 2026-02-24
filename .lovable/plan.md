

## Hour Meter Sequence Tracker

### Problem
When you get an alert about a gap in the hour meter (e.g., MF4297), there's nowhere to go review the full sequence of readings. The gap warning only appears as a brief notification when entering data — it's not saved and can't be reviewed later.

### Solution
Add an **"Horómetro" (Hour Meter) tab** to the Equipment page that shows the chronological sequence of hour meter readings per tractor, with gaps highlighted visually.

### What You'll See

- A new **"Horómetro"** tab on the Equipment page (alongside the existing Tractors and Implements tabs)
- **Tractor selector** dropdown to pick which tractor to inspect
- A **table** showing all operations for that tractor in chronological order:
  - Date | Operation | Field | Start Hours | End Hours | Hours Worked | Gap
- **Gap column** highlights in red/amber when there's a mismatch between one operation's end_hours and the next operation's start_hours
- **Summary card** at the top showing: current hour meter, total gaps found, total gap hours

### Data Source
All data comes from existing operations records (the `operations` table already stores `start_hours` and `end_hours` per tractor). No database changes needed.

### Technical Details

1. **New file**: `src/components/equipment/HourMeterSequenceView.tsx`
   - Query operations filtered by tractor, sorted by date and start_hours
   - Compare each operation's `start_hours` with the previous operation's `end_hours`
   - Flag gaps > 0.1 hours with a red badge showing the gap size
   - Include tractor selector and date range filters

2. **Modified file**: `src/pages/Equipment.tsx`
   - Add "Horómetro" tab pointing to the new component

