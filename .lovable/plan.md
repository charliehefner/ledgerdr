

# Fuel System Audit Findings and Fix Plan

## Audit Summary

### Critical Bug Found: Driver Portal Does Not Deduct Tank Level

The **offline queue sync** (`useOfflineQueue.ts`, lines 126-133) inserts the fuel transaction and updates `last_pump_end_reading`, but **never subtracts gallons from `current_level_gallons`**. Every fuel dispensing submitted through the Driver Portal leaves the tank level unchanged.

**Evidence:**
- Mobile tank DB level: **510.8 gal**
- Apr 9 dispense via portal: **51.6 gal** (submission_source = 'portal') — never deducted
- Correct level after deduction: **459.2 gal**
- Feb 7 portal dispense of 100 gal was also never deducted, but was absorbed by the manual migration reset on Mar 10

### Transaction Reconstruction (from Mar 10 manual reset of 559.7)

| Date | Type | Gallons | Calculated Level |
|------|------|---------|-----------------|
| Mar 10 (migration) | Reset | — | 559.7 |
| Mar 10 | Dispense | -17.5 | 542.2 |
| Mar 11 | Dispense | -50.0 | 492.2 |
| Mar 20 | Dispense | -30.0 | 462.2 |
| Mar 23 | Refill | +235.9 | 698.1 |
| Mar 23 | Transfer out | -100.0 | 598.1 |
| Mar 25 | Dispense ×3 | -87.3 | 510.8 |
| Apr 9 | Dispense (PORTAL) | -51.6 | **459.2** (but DB still shows 510.8) |

### Planta Tank Is Correct
Planta Tank: 374.4 (refills) + 100.0 (transfer in) = **474.4** — matches DB exactly. The Mar 23 transfer DID register correctly in Planta Tank.

### Your Expected 389.2
The difference between calculated (459.2) and your expected (389.2) is 70.0 gallons. This may represent additional physical dispensing not yet recorded in the system, or manual adjustments. The system math checks out from recorded transactions.

---

## Fix Plan

### 1. Fix Driver Portal sync to deduct tank level
In `useOfflineQueue.ts`, add `current_level_gallons` deduction after inserting the transaction — fetch fresh tank level, subtract gallons, and update.

### 2. Add a database trigger as safety net
Create a trigger on `fuel_transactions` INSERT that automatically adjusts `current_level_gallons` based on transaction type (dispense: subtract, refill: add, transfer: subtract from source). This ensures the level stays accurate regardless of which code path creates the transaction.

### 3. Correct the current Mobile tank level
Run a migration to set Mobile tank `current_level_gallons` to **459.2** (or **389.2** if you confirm that's the physically correct amount).

### 4. Remove redundant client-side level updates
Once the database trigger handles level updates, the duplicate client-side deductions in `AgricultureFuelView.tsx`, `FuelTanksView.tsx`, and `PurchaseDialog.tsx` should be removed to prevent double-counting.

---

### Technical Details

**Root cause code** (`useOfflineQueue.ts` lines 126-133):
```typescript
// Only updates pump reading — MISSING current_level_gallons deduction
const { error: tankError } = await supabase
  .from("fuel_tanks")
  .update({ 
    last_pump_end_reading: submission.pumpEndReading,
    updated_at: new Date().toISOString()
  })
  .eq("id", submission.tankId);
```

**Database trigger** will handle all three transaction types:
- `dispense` → subtract from source tank
- `refill` → add to tank (capped at capacity)
- `transfer` → subtract from source, add to destination

