

## Field Aging Gradient on Map

### What it does
Adds an "aging mode" to the Map tab that colors each field boundary based on how many days have passed since the last operation of a selected type. This replaces the default farm-based color scheme when activated.

### Controls (above the map, alongside the existing Satellite/Streets toggle)
- **Operation Type dropdown** -- select which operation type to measure aging from (e.g., "Siembra", "Corte de semilla"). When set to "None" (default), the map uses the existing farm-based coloring.
- **Two threshold inputs** (Green/Yellow boundary and Yellow/Red boundary) -- e.g., Green up to 30 days, Yellow up to 90 days, Red beyond 90 days. Users can adjust these freely.
- **A simple legend** showing the three color bands and the "light grey = no record" indicator.

### Color scheme
- **Green** (#22c55e): 0 days up to Threshold 1
- **Yellow/Amber** (#eab308): Threshold 1 up to Threshold 2
- **Red** (#ef4444): Beyond Threshold 2
- **Light grey** (#d1d5db): Field has no operations of the selected type at all

### Popup enhancement
When aging mode is active, clicking a field shows the existing info (name, farm, area) plus "Last [Operation Type]: X days ago (YYYY-MM-DD)" or "No record".

### Technical Details

**File: `src/components/operations/FieldsMapView.tsx`**

1. **New state variables:**
   - `agingOperationTypeId` (string | null) -- selected operation type for aging
   - `thresholdGreen` (number, default 30) -- days boundary for green-to-yellow
   - `thresholdRed` (number, default 90) -- days boundary for yellow-to-red

2. **New data queries:**
   - Fetch `operation_types` (id, name) for the dropdown -- reuse existing pattern from OperationsLogView
   - When an operation type is selected, fetch operations filtered by that type: query `operations` table selecting `field_id, operation_date` where `operation_type_id = selected`, ordered by `operation_date DESC`. Group client-side to find the most recent date per field_id.

3. **Aging calculation (client-side):**
   - Build a `Map<field_id, number>` of days since last operation (using `differenceInDays` from date-fns)
   - Fields not present in the map get `null` (no record = light grey)

4. **GeoJSON color assignment:**
   - When aging mode is OFF: use existing `farmColorMap` logic (no change)
   - When aging mode is ON: assign each feature's `color` property based on its aging value and the two thresholds. Store `days_since` and `last_date` in feature properties for popup use.

5. **UI controls layout:**
   - Wrap existing toggle button in a flex row
   - Add a Select dropdown for operation type (left side)
   - When an operation type is selected, show two small number inputs for thresholds (labeled "Verde hasta" and "Rojo desde") and the legend
   - All controls use existing shadcn/ui components (Select, Input) with `size="sm"`

6. **Map layer update:**
   - The existing `useEffect` already re-renders when dependencies change. Adding `agingOperationTypeId`, thresholds, and the aging data to the dependency array will trigger a map rebuild with updated colors.

**No database changes required** -- all data already exists in the `operations` table.

