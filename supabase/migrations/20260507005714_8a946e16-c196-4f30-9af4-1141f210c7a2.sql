-- Supplier Contracts: simple amount + default account
CREATE TABLE public.supplier_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  contract_number TEXT,
  description TEXT NOT NULL,
  total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'DOP' CHECK (currency IN ('DOP','USD','EUR')),
  default_account_code TEXT NOT NULL,
  cost_center TEXT NOT NULL DEFAULT 'general' CHECK (cost_center IN ('general','agricultural','industrial')),
  start_date DATE,
  end_date DATE,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','closed','cancelled')),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_supplier_contracts_supplier ON public.supplier_contracts(supplier_id);
CREATE INDEX idx_supplier_contracts_entity ON public.supplier_contracts(entity_id);
CREATE UNIQUE INDEX supplier_contracts_number_unique
  ON public.supplier_contracts(entity_id, supplier_id, contract_number)
  WHERE contract_number IS NOT NULL;

-- Updated_at trigger (reuse existing helper)
CREATE TRIGGER trg_supplier_contracts_updated_at
BEFORE UPDATE ON public.supplier_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.supplier_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_contracts_select_authenticated"
ON public.supplier_contracts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "supplier_contracts_insert_writers"
ON public.supplier_contracts FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'management')
  OR public.has_role(auth.uid(), 'accountant')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "supplier_contracts_update_writers"
ON public.supplier_contracts FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'management')
  OR public.has_role(auth.uid(), 'accountant')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "supplier_contracts_delete_admin"
ON public.supplier_contracts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add contract_id linkage to transactions and ap_ar_documents
ALTER TABLE public.transactions
  ADD COLUMN contract_id UUID REFERENCES public.supplier_contracts(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_contract ON public.transactions(contract_id) WHERE contract_id IS NOT NULL;

ALTER TABLE public.ap_ar_documents
  ADD COLUMN contract_id UUID REFERENCES public.supplier_contracts(id) ON DELETE SET NULL;
CREATE INDEX idx_ap_ar_documents_contract ON public.ap_ar_documents(contract_id) WHERE contract_id IS NOT NULL;

-- Helper function: contract balance
CREATE OR REPLACE FUNCTION public.get_contract_balance(p_contract_id UUID)
RETURNS TABLE (
  total_amount NUMERIC,
  advanced_to_date NUMERIC,
  available NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_advanced NUMERIC;
BEGIN
  SELECT sc.total_amount INTO v_total
  FROM public.supplier_contracts sc WHERE sc.id = p_contract_id;

  IF v_total IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_advanced
  FROM public.transactions t
  WHERE t.contract_id = p_contract_id
    AND t.master_acct_code = '1690'
    AND COALESCE(t.is_void, false) = false;

  RETURN QUERY SELECT
    ROUND(v_total, 2),
    ROUND(v_advanced, 2),
    ROUND(v_total - v_advanced, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_balance(UUID) TO authenticated;