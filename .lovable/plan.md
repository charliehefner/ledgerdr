

## Fix: Inventory Display Precision + Correct Stock Levels + Add Missing P01 Inputs

### Problem Summary

1. **Floating point display**: Operation inputs column (line 1507) and input chips (line 1300) in `OperationsLogView.tsx` display `quantity_used` without `.toFixed(2)`, so raw float values like `0.15000000000000002` appear.

2. **Stock levels inflated by race condition**: Same bug as Revolver — repeated partial mutations inflated stock for Abland, Bionex, and pH Ned.

3. **Missing P01 inputs**: The April 14 P01 operation (ID `43be04dc`) only has Revolver recorded; Abland (0.15L), Bionex (0.625L), and pH Ned (0.15L) are missing.

### Audit Results

| Item | Purchased | Used (recorded) | P01 Missing | Expected Stock | Current DB | Off By |
|------|-----------|-----------------|-------------|---------------|------------|--------|
| Abland | 4.27 | 1.95 | 0.15 | 2.17 | 3.98 | +1.81 |
| Bionex | 11.00 | 10.375 | 0.625 | 0.00 | 7.50 | +7.50 |
| pH Ned | 3.80 | 3.66 | 0.15 | ~0.00 | 1.68 | +1.68 |

### Plan

**1. Data fixes (SQL)**
- Insert 3 missing `operation_inputs` rows for the P01 operation (`43be04dc`): Abland 0.15, Bionex 0.625, pH Ned 0.15
- Correct `current_quantity` for all three items: Abland → 2.17, Bionex → 0.00, pH Ned → 0.00 (purchased 3.80 minus total used 3.81 rounds to 0; cannot go negative)

**2. Display fix — `OperationsLogView.tsx`**
- Line 1300: Change `{input.quantity_used}` to `{Number(input.quantity_used).toFixed(2)}`
- Line 1507: Change `{input.quantity_used}` to `{Number(input.quantity_used).toFixed(2)}`

**3. Database function improvement — `save_operation_inputs`**
- Add `ROUND(..., 4)` to the stock arithmetic inside the function to prevent floating point drift from accumulating over time

### Scope

| Component | Change |
|-----------|--------|
| Data fix (SQL) | 3 input inserts + 3 stock corrections |
| OperationsLogView.tsx | 2 lines — add `.toFixed(2)` to quantity display |
| save_operation_inputs migration | Add ROUND() to arithmetic |

