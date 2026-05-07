-- Drop the old 37-arg overload of create_transaction_with_ap_ar so PostgREST
-- can unambiguously resolve the new 38-arg version (which adds p_supplier_id).
DROP FUNCTION IF EXISTS public.create_transaction_with_ap_ar(
  date, text, text, text, numeric, text, text, date, numeric, numeric, numeric,
  text, text, text, text, text, numeric, boolean, text, text, text, text, text,
  date, numeric, text, uuid, text, numeric, numeric, text, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric
);