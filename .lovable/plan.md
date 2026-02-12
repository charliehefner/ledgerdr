

## Auto-Update Hectares on Boundary Import

### Change

Update the `upsert_field_boundary` database function to automatically recalculate the field's hectares from the imported geometry using PostGIS spatial functions.

### Technical Details

**Database migration** -- Replace the existing `upsert_field_boundary` function with:

```sql
CREATE OR REPLACE FUNCTION public.upsert_field_boundary(p_field_id uuid, p_geojson text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  UPDATE public.fields
  SET boundary = ST_Multi(ST_GeomFromGeoJSON(p_geojson)),
      hectares = ROUND((ST_Area(ST_Transform(ST_Multi(ST_GeomFromGeoJSON(p_geojson)), 32619)) / 10000)::numeric, 2),
      updated_at = now()
  WHERE id = p_field_id;
END;
$$;
```

- Uses `ST_Transform` to project into UTM zone 19N (EPSG:32619) for accurate area measurement in the Dominican Republic
- `ST_Area` returns square meters, divided by 10,000 to convert to hectares, rounded to 2 decimal places
- No frontend changes needed -- hectares are already displayed in field lists, map popups, and reports

### What Is Not Affected

- Past operations retain their own `hectares_done` values
- Fields that are not re-imported keep their manually entered hectares
