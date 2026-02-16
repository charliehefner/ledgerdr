

# Historical GPS Track Viewer with Implement-Colored Tracks

## Overview

Add a "Track History" mode to the Operations Map that lets you select a specific tractor and a date range to see its GPS path. Each segment of the track is colored by the implement that was attached during that operation, so you can visually distinguish what work was being done.

---

## How You'll Use It

1. On the Map tab, a new **"Recorrido GPS"** (Track History) control group appears in the toolbar
2. Select a **tractor** from a dropdown (only tractors linked to GPSGate)
3. Pick a **date or date range** (single day or multi-day)
4. Click **"Ver Recorrido"** -- the map draws the GPS path as colored polylines
5. Each segment is colored by the **implement** used during that time window (matched from operations records)
6. A **legend** appears showing which color corresponds to which implement
7. Clicking a track segment shows a tooltip with: implement name, operation type, date, and estimated hectares

---

## Color Assignment for Implements

Each implement gets a distinct, high-contrast color from a predefined palette:

| Color   | Example Implements   |
|---------|---------------------|
| #e6194b (Red)       | Implement A |
| #3cb44b (Green)     | Implement B |
| #4363d8 (Blue)      | Implement C |
| #f58231 (Orange)    | Implement D |
| #911eb4 (Purple)    | Implement E |
| #42d4f4 (Cyan)      | Implement F |

- Colors are assigned in a fixed order based on the implements present in the selected date range
- Segments where no matching operation/implement is found are drawn in **dashed grey**
- The palette reuses the existing `FARM_COLORS` array already in the codebase

---

## UI Layout (Track History Mode)

```text
+------------------------------------------------------------------+
| [Tractor v] [Date From] [Date To] [Ver Recorrido] | Sat/Streets |
+------------------------------------------------------------------+
|                                                                  |
|   MAP with field boundaries (semi-transparent)                   |
|                                                                  |
|   ~~~~ colored polylines showing tractor path ~~~~               |
|                                                                  |
|                                          +------------------+    |
|                                          | LEGEND           |    |
|                                          | -- Rastra (red)  |    |
|                                          | -- Arado (blue)  |    |
|                                          | -- Sin impl (grey)|   |
|                                          +------------------+    |
+------------------------------------------------------------------+
```

---

## Technical Implementation

### 1. Edge Function: `gpsgate-proxy` (tracks action)

When called with `action=tracks`, the function:
- Receives `tractorId`, `dateFrom`, `dateTo`
- Looks up the tractor's `gpsgate_user_id` from `fuel_equipment`
- Calls GPSGate API: `GET /applications/685/users/{gpsgate_user_id}/tracks?from={dateFrom}&to={dateTo}`
- Returns an array of GPS points: `[{ lat, lng, timestamp, speed }, ...]`

### 2. Matching GPS Segments to Implements

The track coloring works by cross-referencing GPS timestamps with operations records:

- Query operations for the selected tractor in the date range:
  ```sql
  SELECT operation_date, implement_id, implements.name, 
         start_hours, end_hours, operation_types.name
  FROM operations
  JOIN implements ON ...
  WHERE tractor_id = ? AND operation_date BETWEEN ? AND ?
  ORDER BY operation_date
  ```
- For each day, the GPS points are colored using the implement from that day's operation
- If multiple operations exist on the same day with different implements, hours-based splitting is used (proportional to the operation duration)
- Unmatched segments default to grey dashed lines

### 3. Map Rendering (Mapbox GL Layers)

For each implement in the result set, add a separate `line` layer:
- Source: GeoJSON LineString of the GPS points for that implement's segments
- Paint: `line-color` set to the implement's assigned color, `line-width: 3`
- Unmatched segments: `line-dasharray: [2, 4]`, grey color

### 4. New Components

- **`TrackHistoryControls.tsx`**: Toolbar section with tractor selector, date pickers, and "Ver Recorrido" button. Only visible when GPS integration is active.
- **`TrackLegend.tsx`**: Floating legend panel showing implement-to-color mapping for the current view.
- Update **`FieldsMapView.tsx`**: Add state for track history mode, render track layers on the map, and integrate the new controls.

### 5. Database Prerequisite

This feature depends on the GPS integration step that adds `gpsgate_user_id` to `fuel_equipment`. It will be built as part of the GPS integration, not separately.

---

## Interaction with Other Map Modes

- Track History mode and Field Aging mode are **mutually exclusive** -- selecting one deactivates the other
- Field boundaries remain visible (at reduced opacity) as context beneath the tracks
- The expand/fullscreen toggle continues to work in track history mode
- Live GPS positions (from the real-time feature) can optionally overlay on top of historical tracks

