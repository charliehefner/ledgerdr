

## Add Industry Fueling Report from Plant Hours Data

### Problem
The Industry tab in Fuel Management currently shows a "Generator Usage Log" sourced from `fuel_transactions` (only 3 records). The user wants it to show diesel consumption data from the `industrial_plant_hours.estimated_diesel_liters` column that was just added. Agriculture's Fueling Report already works correctly from `fuel_transactions`.

### Plan

**1. Rewrite `IndustryFuelView.tsx` to add a Fueling Report tab**

Add a tabbed layout matching Agriculture's pattern (Fueling Report + existing Generator Usage):

- **Fueling Report tab** (new, default): Query `industrial_plant_hours` for rows where `estimated_diesel_liters IS NOT NULL`, filtered by date range. Show a table with columns: Date, Start Hour Meter, Finish Hour Meter, Hours Run, Est. Diesel (L), Notes. Include date range pickers and export (Excel/PDF). Show summary totals for hours and liters.

- **Tank/Refill section**: Keep the existing tank refill functionality and tank level cards.

Data source for the report:
```sql
SELECT date, start_hour_meter, finish_hour_meter, estimated_diesel_liters, notes
FROM industrial_plant_hours
WHERE estimated_diesel_liters IS NOT NULL
ORDER BY date DESC
```

**2. Keep existing tank stats and refill dialog**

The tank level cards and "Record Tank Refill" button remain. The "Record Hour Meter" / generator reading functionality can be removed or kept as secondary — since plant hours are now recorded in the Industrial module's Plant Hours tab.

### Scope

| Component | Change |
|-----------|--------|
| `IndustryFuelView.tsx` | Add Fueling Report tab sourced from `industrial_plant_hours`, with date filtering, summary, and export |

