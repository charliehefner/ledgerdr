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