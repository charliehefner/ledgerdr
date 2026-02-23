

# GPS-Operations Cross-Validation Alerts

## Overview

Add four new alert types under the "Operaciones" sector on the Alerts page. These alerts cross-reference GPS telemetry data with the operations log to catch data entry errors and unrecorded work.

## Alert Types

### Alert 1: Hectares Exceed Field Size
- **Trigger:** `operation.hectares_done > field.hectares` (and field hectares > 0)
- **Data source:** Pure database query -- operations joined with fields
- **Severity:** Warning (yellow)
- **Example:** *"CY-03: 45 ha registradas pero el campo tiene 38 ha (Rastra - 15/02/2026)"*

### Alert 2: Unrecorded Tractor Activity (same-day at 19:00+)
- **Trigger:** GPS shows a tractor was moving (speed > 0 or engine on) but no operation exists for that tractor on that date
- **Timing:** Checks today (only after 19:00 local time) and yesterday. Persists until an operation is added or next day passes.
- **Data source:** `gpsgate-proxy?action=live-positions` endpoint (returns `lastUpdate`, `speed`, `engineOn` for each linked tractor), cross-referenced against operations table
- **Severity:** Warning for today (after 19:00), Urgent for yesterday
- **Example:** *"JD-7230R tuvo actividad GPS hoy pero no tiene operacion registrada"*

### Alert 3: Operation Without Tractor Movement
- **Trigger:** A mechanical operation is logged for a GPS-linked tractor, but GPS shows the tractor had no significant movement
- **Checks:** Last 2 days only
- **Severity:** Warning
- **Example:** *"JD-8R registra operacion el 22/02 pero GPS no muestra movimiento"*

### Alert 4: Hectares Mismatch vs GPS Estimate
- **Trigger:** The registered `hectares_done` differs from the GPS-estimated hectares by more than 30% (configurable)
- **Data source:** Uses the existing `computeFieldMetrics` logic and GPS area estimation (`distance * working_width / 10000`) from track history
- **Only checks:** Operations from the last 2 days with GPS-linked tractors that have field boundaries
- **Severity:** Warning
- **Example:** *"CY-03 Rastra: 1.5 ha registradas vs ~1.0 ha estimadas por GPS (23/02/2026)"*

## Configuration

Each alert type gets a row in the existing `alert_configurations` table so admins can toggle them on/off individually:

| alert_type | Default Active | threshold_value |
|---|---|---|
| `hectares_exceed_field` | Yes | null (no threshold needed) |
| `gps_unrecorded_activity` | Yes | null |
| `gps_no_movement` | Yes | null |
| `gps_hectares_mismatch` | Yes | 30 (percent tolerance) |

The config dialog will show these four new entries with labels and the hectares mismatch one will show a "%" threshold input.

## Technical Details

### Database Migration

Insert default config rows for the four new alert types:

```sql
INSERT INTO alert_configurations (alert_type, is_active, threshold_value)
VALUES
  ('hectares_exceed_field', true, NULL),
  ('gps_unrecorded_activity', true, NULL),
  ('gps_no_movement', true, NULL),
  ('gps_hectares_mismatch', true, 30)
ON CONFLICT DO NOTHING;
```

### Files to Modify

| File | Change |
|---|---|
| `src/components/alerts/useAlertData.ts` | Add `useOperationsGpsAlerts()` hook containing all four alert checks. Merge results into existing operations alerts. |
| `src/pages/Alerts.tsx` | Wire the new hook, combine its alerts with the existing `useOperationsAlerts` results in the Operaciones sector |
| `src/components/alerts/AlertConfigDialog.tsx` | Add labels for the four new alert types so they appear in the config dialog |

### Implementation Approach

**Alert 1 (hectares vs field):** Query `operations` with `fields(hectares)` join for the last 30 days. Compare `hectares_done > field.hectares` client-side. No GPS call needed.

**Alert 2 (unrecorded activity):** Call `gpsgate-proxy?action=live-positions` (same endpoint the map uses). This returns all GPS-linked tractors with their last known position, speed, engine status, and `lastUpdate` timestamp. For each tractor that shows recent activity (lastUpdate within today or yesterday), check if a matching operation exists. Only surface today's alerts if current hour >= 19.

**Alert 3 (no GPS movement):** For operations logged in the last 2 days on GPS-linked tractors, check the live-positions data. If the tractor's `lastUpdate` is not within the operation date or speed was 0, flag it.

**Alerts 2 and 3** share a single `live-positions` API call. The edge function already returns all linked tractors in one request, so there is no per-tractor overhead.

**Alert 4 (hectares mismatch):** For operations in the last 2 days on GPS-linked tractors with fields that have boundary data, call `gpsgate-proxy?action=tracks` for each tractor/date. Use the existing `computeFieldMetrics` function to calculate in-field time, then estimate hectares using the area formula. Compare with `hectares_done`. This is the most expensive check so it is limited to 2 days and only runs for tractors with GPS links and fields with boundaries.

### Performance Considerations

- Live-positions is a single API call returning all tractors (already used by the map)
- Hectares-vs-field is pure database, no GPS call
- Track history calls for Alert 4 are limited to the last 2 days and only GPS-linked tractors
- All alerts are read-only and non-blocking
- Data is cached by React Query with standard stale times

