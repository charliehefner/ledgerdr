

## Implement KML/KMZ Field Boundary Import with Mapbox Satellite Map

### Summary

Add the ability to upload KML/KMZ files containing field boundaries, store them as PostGIS geometries linked to existing fields, and visualize them on an interactive Mapbox satellite map. Since you will ensure names match between the file and database beforehand, the matching will be straightforward exact-match by name.

### Steps

**1. Database Migrations (2)**

- Enable the PostGIS extension: `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;`
- Add a `boundary` column to the `fields` table: `geometry(MultiPolygon, 4326)` with a spatial index (`GIST`)

**2. New Edge Function: `import-field-boundaries`**

- Receives an array of `{ field_id, geojson }` pairs
- Requires authentication
- Upserts each field's `boundary` column using `ST_GeomFromGeoJSON()` via a raw RPC or direct SQL function
- A small database function `upsert_field_boundary(field_id uuid, geojson text)` will handle the PostGIS conversion server-side

**3. New File: `src/components/operations/kmlParser.ts`**

- Utility that accepts a File (`.kml` or `.kmz`)
- Uses `JSZip` (already installed) to unzip KMZ files
- Parses KML XML with browser `DOMParser`
- Extracts each `Placemark` name and its polygon coordinates
- Returns an array of `{ name, geojson }` objects

**4. New File: `src/components/operations/KMLImportDialog.tsx`**

- Dialog with file upload (accepts `.kml`, `.kmz`)
- After parsing, shows a preview table: Placemark Name | Matched Field | Farm | Status
- Matching logic: exact case-insensitive name match against existing fields
- Unmatched placemarks shown with a warning (user can skip them)
- "Import" button sends matched boundaries to the edge function
- Success toast with count of imported boundaries

**5. Modified: `src/components/operations/FarmsFieldsView.tsx`**

- Add an "Import Boundaries" button next to the existing Add Farm / Add Field buttons
- Show a small map pin icon next to fields that already have a boundary stored

**6. New File: `src/components/operations/FieldsMapView.tsx`**

- Mapbox GL JS map component using `mapbox://styles/mapbox/satellite-streets-v12` base layer
- Fetches all fields with boundaries from the database
- Renders each field boundary as a filled polygon, color-coded by farm
- Click a polygon to see a popup with field name, farm, and hectares
- Auto-fits map bounds to show all imported boundaries
- Style toggle button to switch between satellite and streets view

**7. Modified: `src/pages/Operations.tsx`**

- Add a "Map" tab in the right-aligned tab group, rendering `FieldsMapView`

**8. New Dependency**

- `mapbox-gl` (and its CSS import for map controls)

**9. Edge Function Config**

- Add `[functions.import-field-boundaries]` with `verify_jwt = false` to `supabase/config.toml` (auth validated in code)

### Technical Notes

- The Mapbox public token `pk.eyJ1Ijo...` will be stored as a constant in `FieldsMapView.tsx`
- `boundary` uses `MultiPolygon` type to handle both simple and multi-part polygons from KML
- The database function `upsert_field_boundary` avoids raw SQL in the edge function -- it's a parameterized PL/pgSQL function that only accepts a UUID and a GeoJSON text string
- RLS on the `fields` table already governs access; the edge function authenticates the user before processing

