

## Add Estimated Diesel Used Column to Plant Hours

### What
Add an `estimated_diesel_liters` column to the Plant Hours table so operators can manually record estimated diesel consumption per session. This gives a mechanism to track diesel drawdown from the Industrial Diesel tank.

### Plan

**1. Database migration — add column**
```sql
ALTER TABLE industrial_plant_hours
ADD COLUMN estimated_diesel_liters numeric NULL;
```

**2. Update `PlantHoursView.tsx`**
- Add `estimated_diesel_liters` to the form state, insert, update, and edit logic
- Add a new column in the table between "Est. Tons" and "Notes"
- Add the field to the dialog form with label "Est. Diesel (L)"
- Include the new column in both Excel and PDF exports

**3. Add i18n keys** (both `en.ts` and `es.ts`)
- `"industrial.estimatedDiesel"`: "Est. Diesel (L)" / "Diesel Est. (L)"

### Scope

| Component | Change |
|-----------|--------|
| SQL migration | Add `estimated_diesel_liters` column |
| `PlantHoursView.tsx` | Form field, table column, insert/update/export |
| `en.ts` / `es.ts` | 1 new i18n key each |

