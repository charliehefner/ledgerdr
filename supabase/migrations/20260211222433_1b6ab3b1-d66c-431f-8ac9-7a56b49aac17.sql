
-- Function to return fields with their boundaries as GeoJSON
CREATE OR REPLACE FUNCTION public.get_fields_with_boundaries()
RETURNS TABLE(
  id uuid,
  name text,
  hectares numeric,
  farm_id uuid,
  farm_name text,
  boundary jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    f.id,
    f.name,
    f.hectares,
    f.farm_id,
    farms.name as farm_name,
    CASE WHEN f.boundary IS NOT NULL 
      THEN ST_AsGeoJSON(f.boundary)::jsonb 
      ELSE NULL 
    END as boundary
  FROM fields f
  JOIN farms ON farms.id = f.farm_id
  WHERE f.is_active = true
  ORDER BY farms.name, f.name;
$$;
