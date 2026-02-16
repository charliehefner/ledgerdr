

## Fix: Map Label Error

The error `"text-field" requires a style "glyphs" property` occurs because the satellite map uses a custom ESRI style that doesn't include a font (glyphs) source. Text labels need fonts to render, and unlike the Mapbox streets style which includes them automatically, custom styles must declare them explicitly.

### What will change

**File: `src/components/operations/FieldsMapView.tsx`**

Add a `glyphs` property to the `esriSatelliteStyle` object pointing to Mapbox's hosted fonts:

```typescript
const esriSatelliteStyle: mapboxgl.StyleSpecification = {
  version: 8,
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: { ... },
  layers: [ ... ],
};
```

This is a one-line addition. No other changes needed -- the streets style already includes glyphs by default, so only the satellite/ESRI custom style is affected.

