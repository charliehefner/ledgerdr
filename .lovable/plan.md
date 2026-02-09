

# Fix Mobile Tank Level to 400.0 Gallons

## Problem
The Mobile tank level was previously set to 288.3, then proposed at 389.3, but both incorrectly included pre-zeroing dispenses. The 10.7 gal dispense on Feb 6 occurred before the tank was zeroed and refilled with 500 gal, so it should not reduce the current volume.

## Correct Calculation
- Tank zeroed, then refilled: **+500.0 gal**
- Feb 7 dispense (only post-refill event): **-100.0 gal**
- **Correct level: 400.0 gal**

## Fix
Update `current_level_gallons` for the Mobile tank in the `fuel_tanks` table to **400.0**.

This is a one-time data correction. No code changes are needed.
