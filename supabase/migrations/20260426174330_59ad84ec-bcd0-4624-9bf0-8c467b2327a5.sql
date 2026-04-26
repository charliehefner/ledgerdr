CREATE OR REPLACE FUNCTION public.count_unlinked_transactions(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM transactions t
  WHERE t.is_void = false
    AND t.approval_status IN ('auto_approved', 'approved')
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end   IS NULL OR t.transaction_date <= p_end)
    AND NOT EXISTS (
      SELECT 1 FROM journals j
      WHERE j.transaction_source_id = t.id
        AND j.deleted_at IS NULL
    );
$function$;