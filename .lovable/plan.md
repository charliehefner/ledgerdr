

## Fix: Replace Invalid Mapbox Token

### Change
Update the Mapbox access token in `src/components/operations/FieldsMapView.tsx` (line 12) with your valid token.

### Technical Detail
- **File**: `src/components/operations/FieldsMapView.tsx`
- **Line 12**: Replace the old token with `pk.eyJ1IjoiY2hhcmxlc2hlZm5lcmpvcmQiLCJhIjoiY21saWx4YjJyMDRtZDNmb3B5dzZwenBxZiJ9.k8mtyT5Xip_xmjOv0sN8WQ`
- This is a publishable (public) Mapbox token, so it is safe to store directly in the codebase
- Once updated, the satellite imagery and field boundaries should render immediately on the Map tab

