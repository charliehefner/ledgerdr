

## Switch Map Base Layer to Esri World Imagery

Esri World Imagery tiles are freely available without API keys. The change is straightforward — replace the Mapbox raster style URLs with Esri's tile endpoint as a raster source, while keeping all existing functionality (field boundaries, popups, aging mode, labels, style toggle).

### Technical Details

**File: `src/components/operations/FieldsMapView.tsx`**

1. Replace the Mapbox style URLs with a blank Mapbox style that uses Esri World Imagery as a raster tile source:
   - Satellite mode: Use `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` as a raster tile layer
   - Streets mode: Keep the existing `mapbox://styles/mapbox/streets-v12` (no change needed for streets)

2. For satellite mode, initialize the map with an empty Mapbox style object and inject the Esri raster source and layer on load, before adding the fields GeoJSON layers on top.

3. All existing features remain unchanged:
   - Farm color-coding and field boundaries
   - Aging gradient visualization
   - Interactive popups
   - Label rendering
   - Satellite/Streets toggle
   - Zoom-to-bounds behavior

No new API keys, secrets, or dependencies are required. The Mapbox token is still needed for the streets style and the GL JS renderer itself.

