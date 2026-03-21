
CREATE TRIGGER audit_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_inventory_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_fuel_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_fuel_tanks
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_tanks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_operations
  AFTER INSERT OR UPDATE OR DELETE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_operation_inputs
  AFTER INSERT OR UPDATE OR DELETE ON public.operation_inputs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
