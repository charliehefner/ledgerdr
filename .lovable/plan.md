## Goal

In **Fuel → Tractor History**, add an expandable panel per tractor (in the per-tractor summary cards) that shows the **gal/hr for the last 3 completed fueling intervals**.

Drop the previously-proposed change to Equipment → Tractors.

## The corrected calculation

A fueling interval is only "complete" when the **next** fueling occurs (because that next fueling reveals how many gallons were burned). So the gal/hr attributed to fueling N requires fueling N+1 to exist:

```
interval_hours   = fueling[N+1].hour_meter_reading − fueling[N].hour_meter_reading
interval_gallons = fueling[N+1].gallons        // gallons added to refill what N consumed
gal_per_hour     = interval_gallons / interval_hours    (when interval_hours > 0)
```

Display the result against fueling **N** (the start of the interval), labeled with both the **start date** (fueling N) and **closed-by date** (fueling N+1).

## Fix the existing per-row "Gal/Hr" column too

The current table column in `TractorHistoryView` computes `gallons / (hour_meter_reading − previous_hour_meter)` on the **same** row, which mixes the gallons added now with the hours worked since the prior fueling — economically meaningless, as you noted.

Fix: shift the calculation by one. For each row N (sorted ascending by hour meter / date), gal/hr = `nextFueling.gallons / (nextFueling.hour_meter_reading − N.hour_meter_reading)`. The most recent fueling shows `—` (pending — no closing fueling yet). Tooltip on `—`: "Awaiting next fueling to close the interval."

This applies to:
- The **per-row "Gal/Hr" column** in the transactions table.
- The **per-tractor summary card** average (sum of closed-interval gallons ÷ sum of closed-interval hours, ignoring the still-open last fueling).
- The **new expandable panel** showing the last 3 closed intervals.

## Expandable panel UI

Each summary card (top of the page) gets a chevron button in its header. Clicking expands the card to reveal a compact sub-table of the **last 3 closed intervals** for that tractor:

| Interval start | Closed by | Hours | Gallons added | Gal/Hr |
|---|---|---|---|---|

- Newest first.
- Color: `> 5 gal/hr` destructive, otherwise primary (matches existing convention).
- Empty state when fewer than 1 closed interval exists: "Need at least 2 fuelings to compute consumption."

State: `useState<string | null>(expandedTractorId)` so only one card expands at a time. Use existing `Collapsible` from `@/components/ui/collapsible.tsx`.

## Implementation details

All work happens in `src/components/fuel/TractorHistoryView.tsx` — no DB, no migration, no other files.

1. **Build a per-tractor sorted history** (ascending by `hour_meter_reading`, then `transaction_date`) from the `transactions` query already loaded.
2. **Pair each fueling N with N+1** to derive `closedIntervals[]` = `{ startDate, closedDate, hours, gallons, galPerHour }[]` per tractor.
3. **Update `transactionsWithStats`** so the row's `consumptionRate` is now sourced from the closing-interval lookup (map by `tx.id` → galPerHour). The most recent row per tractor → `null`.
4. **Update `tractorSummaries`** — `totalGallons`/`totalHours`/`avgConsumption` come from `closedIntervals`, not from raw rows.
5. **Render** the chevron + Collapsible content inside each `<Card>`.

## Edge cases

- Date filtering: closed-interval pairing must use the **unfiltered** per-tractor history (otherwise filters break interval pairing); date filter still narrows the visible **table** rows but the panel + summary always reflect the latest data for that tractor.
- Skip intervals where `interval_hours ≤ 0` (bad meter entries) — exclude from average and panel, but keep the row visible in the table with `—`.
- Round gal/hr to 2 decimals; round hours to 1 decimal (matches existing formatting & Core memory's float-rounding rule).

## Files to change

- `src/components/fuel/TractorHistoryView.tsx` — only file touched.
- (Optional) `src/i18n/es.ts`, `src/i18n/en.ts` — labels for the new panel ("Last 3 fuelings", "Closed by", "Awaiting next fueling"). Strings will be added to both locales.
