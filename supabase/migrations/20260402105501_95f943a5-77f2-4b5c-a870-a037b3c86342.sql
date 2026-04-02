CREATE OR REPLACE FUNCTION public.get_all_public_tables()
RETURNS TABLE(table_name text, row_estimate bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    t.table_name::text,
    COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
  FROM information_schema.tables t
  LEFT JOIN pg_stat_user_tables s 
    ON s.relname = t.table_name AND s.schemaname = 'public'
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;