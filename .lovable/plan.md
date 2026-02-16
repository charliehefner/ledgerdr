

# GPS Field Metrics -- On-Demand Loading

## Overview
Add GPS-derived performance metrics to each operation card in the Field History panel. Metrics load only when the user clicks a button on a specific operation card, keeping the system lightweight.

## Metrics Calculated
- **Viaje (Travel Time)**: Time from the first GPS point of the day until the tractor first enters the field boundary
- **En campo (Field Time)**: Total time span of GPS points inside the field polygon
- **Tiempo muerto (Downtime)**: Sum of time intervals for in-field points where speed is below 0.5 km/h
- **Vel. promedio (Avg Moving Speed)**: Average speed of in-field points where speed is at or above 0.5 km/h

## Performance Impact
- Zero extra load by default -- metrics are fetched only when a user clicks "Ver metricas GPS" on a single operation card
- One GPSGate API call per click (via the existing `gpsgate-proxy` edge function)
- Point-in-polygon calculation runs client-side using a lightweight ray-casting algorithm
- Results are cached in component state so re-clicking does not re-fetch

## Technical Details

### 1. Add utility functions to `src/components/operations/utils.ts`

**`pointInPolygon(lat, lng, polygon)`** -- Ray-casting algorithm to check if a coordinate falls inside a GeoJSON polygon ring.

**`computeFieldMetrics(trackPoints, fieldBoundaryGeoJSON)`** -- Takes flat GPS points (with lat, lng, timestamp, speed) and a GeoJSON geometry (Polygon or MultiPolygon). Returns:
```
{ travelMinutes, fieldMinutes, downtimeMinutes, avgSpeedKmh }
```

Logic:
1. Sort points by timestamp
2. For each point, determine if it is inside any polygon ring
3. First in-field point marks end of travel time (from day's first point)
4. Accumulate in-field time spans, split into moving vs stationary by speed threshold
5. Calculate averages

### 2. Update `src/components/operations/FieldHistoryPanel.tsx`

- Add `fieldBoundary` prop (GeoJSON geometry from the fields query)
- Also select `tractor_id` in the operations query (needed to fetch GPS tracks)
- Add a "Ver metricas GPS" button on each operation card (only shown if the operation has a `tractor_id`)
- On click: fetch GPS tracks for that tractor on that date via `gpsgate-proxy`, run `computeFieldMetrics`, display results inline
- Maintain a `metricsCache` state (Map of operation ID to results) so clicking again does not re-fetch
- Show a spinner while loading

Display format below each card:
```
Viaje: 25 min
En campo: 4h 12min
Tiempo muerto: 38 min
Vel. promedio: 6.2 km/h
```

### 3. Update `src/components/operations/FieldsMapView.tsx`

- Pass the selected field's `boundary` GeoJSON to `FieldHistoryPanel` as a new `fieldBoundary` prop
- The boundary is already available in the `fields` query data (`FieldWithBoundary.boundary`), so look up the selected field by ID and pass its boundary

### Files Modified
| File | Change |
|------|--------|
| `src/components/operations/utils.ts` | Add `pointInPolygon` and `computeFieldMetrics` functions |
| `src/components/operations/FieldHistoryPanel.tsx` | Add boundary prop, tractor_id in query, per-card metrics button with on-demand loading and caching |
| `src/components/operations/FieldsMapView.tsx` | Look up and pass `fieldBoundary` to the panel |

