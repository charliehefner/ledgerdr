
-- Create advance_allocations table
CREATE TABLE public.advance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_doc_id UUID NOT NULL REFERENCES public.ap_ar_documents(id),
  invoice_doc_id UUID NOT NULL REFERENCES public.ap_ar_documents(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  allocated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advance_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing AP/AR tables
CREATE POLICY "Management full access" ON public.advance_allocations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'accountant')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Viewer can view" ON public.advance_allocations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'viewer')
    OR public.has_role(auth.uid(), 'supervisor')
  );

-- Validation trigger: BEFORE INSERT
CREATE OR REPLACE FUNCTION public.validate_advance_allocation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_adv_balance NUMERIC;
  v_inv_balance NUMERIC;
  v_adv_contact TEXT;
  v_inv_contact TEXT;
  v_adv_type TEXT;
  v_inv_type TEXT;
BEGIN
  -- Get advance doc info
  SELECT balance_remaining, contact_name, document_type
  INTO v_adv_balance, v_adv_contact, v_adv_type
  FROM ap_ar_documents WHERE id = NEW.advance_doc_id;

  -- Get invoice doc info
  SELECT balance_remaining, contact_name, document_type
  INTO v_inv_balance, v_inv_contact, v_inv_type
  FROM ap_ar_documents WHERE id = NEW.invoice_doc_id;

  -- Validate advance document is actually an advance
  IF v_adv_type != 'advance' THEN
    RAISE EXCEPTION 'El documento de anticipo no es de tipo advance';
  END IF;

  -- Validate invoice is a bill/invoice
  IF v_inv_type NOT IN ('invoice', 'bill') THEN
    RAISE EXCEPTION 'Solo se pueden aplicar anticipos a facturas';
  END IF;

  -- Validate same contact
  IF v_adv_contact != v_inv_contact THEN
    RAISE EXCEPTION 'El anticipo y la factura deben ser del mismo proveedor';
  END IF;

  -- Validate amount doesn't exceed advance balance
  IF NEW.amount > v_adv_balance THEN
    RAISE EXCEPTION 'El monto excede el balance del anticipo (disponible: %)', v_adv_balance;
  END IF;

  -- Validate amount doesn't exceed invoice balance
  IF NEW.amount > v_inv_balance THEN
    RAISE EXCEPTION 'El monto excede el balance de la factura (disponible: %)', v_inv_balance;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_advance_allocation
  BEFORE INSERT ON public.advance_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_advance_allocation();

-- Sync trigger: AFTER INSERT - update balances on both docs
CREATE OR REPLACE FUNCTION public.sync_advance_allocation_balances()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_new_paid NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Update advance doc: increase amount_paid, recalc balance
  UPDATE ap_ar_documents
  SET amount_paid = amount_paid + NEW.amount,
      balance_remaining = total_amount - (amount_paid + NEW.amount),
      status = CASE
        WHEN total_amount - (amount_paid + NEW.amount) <= 0 THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = now()
  WHERE id = NEW.advance_doc_id;

  -- Update invoice doc: increase amount_paid, recalc balance
  UPDATE ap_ar_documents
  SET amount_paid = amount_paid + NEW.amount,
      balance_remaining = total_amount - (amount_paid + NEW.amount),
      status = CASE
        WHEN total_amount - (amount_paid + NEW.amount) <= 0 THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = now()
  WHERE id = NEW.invoice_doc_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_advance_allocation_balances
  AFTER INSERT ON public.advance_allocations
  FOR EACH ROW EXECUTE FUNCTION public.sync_advance_allocation_balances();
