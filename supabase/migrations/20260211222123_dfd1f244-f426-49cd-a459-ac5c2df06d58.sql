
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Add boundary column to fields
ALTER TABLE public.fields
ADD COLUMN boundary geometry(MultiPolygon, 4326);

-- Spatial index
CREATE INDEX idx_fields_boundary ON public.fields USING GIST (boundary);

-- Helper function for edge function to upsert boundaries
CREATE OR REPLACE FUNCTION public.upsert_field_boundary(p_field_id uuid, p_geojson text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.fields
  SET boundary = ST_Multi(ST_GeomFromGeoJSON(p_geojson)),
      updated_at = now()
  WHERE id = p_field_id;
END;
$$;
