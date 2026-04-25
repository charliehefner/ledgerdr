DROP FUNCTION IF EXISTS public.get_pending_approvals(uuid);

CREATE OR REPLACE FUNCTION public.get_pending_approvals(p_entity_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(request_id uuid, applies_to text, record_id uuid, amount numeric, currency text, description text, submitted_by text, submitted_at timestamp with time zone, entity_id uuid, entity_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_global_admin() OR public.has_role(auth.uid(), 'management')) THEN
    RAISE EXCEPTION 'Insufficient permissions to view approval queue';
  END IF;

  RETURN QUERY
  SELECT
    ar.id,
    ar.applies_to,
    ar.record_id,
    ar.amount,
    ar.currency,
    ar.description,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', ''),
      NULLIF(u.raw_user_meta_data->>'username', ''),
      NULLIF(u.email, ''),
      ar.submitted_by::text
    ) AS submitted_by,
    ar.submitted_at,
    ar.entity_id,
    e.name AS entity_name
  FROM approval_requests ar
  LEFT JOIN entities e ON e.id = ar.entity_id
  LEFT JOIN auth.users u ON u.id = ar.submitted_by
  WHERE ar.status = 'pending'
    AND (p_entity_id IS NULL OR ar.entity_id = p_entity_id)
    AND (
      public.is_global_admin()
      OR public.user_has_entity_access(ar.entity_id)
    )
  ORDER BY ar.submitted_at ASC;
END;
$function$;

NOTIFY pgrst, 'reload schema';