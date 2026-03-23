

## Fix: Adjust Destination Tank Pump Gauge on Transfer

### Problem
When fuel is transferred to a destination tank, the `current_level_gallons` is updated but `last_pump_end_reading` is not adjusted. Since the pump gauge counts consumed fuel (starts high when empty, resets toward 0 when refilled), adding fuel to a tank must adjust the reading — same as a purchase refill does.

Without this fix, the next dispense from the destination tank will fail pump start validation because the expected reading won't account for the transferred fuel.

### Solution
Apply the same pump reading adjustment used during purchases: `new_reading = Math.max(0, old_reading - gallons_transferred)`.

### Changes

**`src/components/fuel/FuelTanksView.tsx`** — In the `transferMutation`, after updating the destination tank's `current_level_gallons`, also fetch and adjust `last_pump_end_reading`:

```typescript
// Current code only updates current_level_gallons on destination
// Add: adjust pump reading same as purchase refill logic
const oldPumpReading = freshDest.last_pump_end_reading ?? 0;
const newPumpReading = Math.max(0, oldPumpReading - gallons);

await supabase
  .from("fuel_tanks")
  .update({ 
    current_level_gallons: newLevel,
    last_pump_end_reading: newPumpReading 
  })
  .eq("id", data.destination_tank_id);
```

The source tank's pump reading stays unchanged since the fuel isn't dispensed through the pump meter — it's a direct transfer.

| File | Change |
|------|--------|
| `src/components/fuel/FuelTanksView.tsx` | Adjust destination tank's `last_pump_end_reading` during transfer (same logic as purchase refill) |

