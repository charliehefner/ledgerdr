
## Add Stats Box to Horas Planta

### Update from feedback
The `estimated_diesel_liters` field actually stores **gallons** despite its name. No unit conversion needed — sum the field directly and label it "Galones / Gallons".

### Layout
Stats card placed above the table, below the action row (Add / Export). Wraps on narrow screens.

### Controls
- **Start date** + **End date** (`<Input type="date">`)
- Default: first day of current month → today

### Calculations (filter rows where `date` ∈ [start, end])
- **Hours** = Σ (`finish_hour_meter` − `start_hour_meter`) where both present
- **Tons** = Σ `estimated_tons`
- **Gallons** = Σ `estimated_diesel_liters` (no conversion)
- **Ton / Gallon** = Tons ÷ Gallons
- **Gallon / Hour** = Gallons ÷ Hours
- **Ton / Hour** = Tons ÷ Hours

All rounded to 2 decimals, `tabular-nums`, "—" when divisor is 0.

### Files Changed
1. `src/components/industrial/PlantHoursView.tsx` — add date state, `useMemo` aggregates, render stats card
2. `src/i18n/es.ts` and `src/i18n/en.ts` — add keys: `industrial.statsTitle`, `industrial.from`, `industrial.to`, `industrial.gallons`, `industrial.tonPerGallon`, `industrial.gallonPerHour`, `industrial.tonPerHour`

### Notes
- Uses already-loaded `rows`; no extra queries
- Reactive — recomputes as records change or dates are adjusted
