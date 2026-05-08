
ALTER VIEW public.home_office_balance SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.post_home_office_advance(uuid,uuid,date,text,varchar,numeric,numeric,uuid,uuid,text,text,uuid,uuid,uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.post_home_office_repayment(uuid,uuid,date,varchar,numeric,numeric,uuid,uuid,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.post_home_office_interest_accrual(uuid,uuid,date,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.capitalize_interest_to_principal(uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.capitalize_cip_project(uuid,text,date,int,numeric,uuid,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revalue_open_home_office(date,uuid,uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._ho_acct(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._ho_resolve_period(date) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.post_home_office_advance(uuid,uuid,date,text,varchar,numeric,numeric,uuid,uuid,text,text,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_home_office_repayment(uuid,uuid,date,varchar,numeric,numeric,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_home_office_interest_accrual(uuid,uuid,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capitalize_interest_to_principal(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capitalize_cip_project(uuid,text,date,int,numeric,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revalue_open_home_office(date,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ho_acct(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ho_resolve_period(date) TO authenticated;
