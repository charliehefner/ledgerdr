
-- 1. Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL DEFAULT current_user_entity_id() REFERENCES public.entities(id),
  name text NOT NULL,
  rnc text,
  apodo text,
  contact_person text,
  phone text,
  email text,
  address text,
  bank text,
  bank_account_type text CHECK (bank_account_type IN ('savings','current')),
  bank_account_number text,
  currency text DEFAULT 'DOP' CHECK (currency IN ('DOP','USD','EUR')),
  default_dgii_bs_type text CHECK (default_dgii_bs_type IN ('B','S')),
  rnc_attachment_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_rnc_unique_per_entity UNIQUE (entity_id, rnc)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_entity ON public.suppliers(entity_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_rnc ON public.suppliers(rnc) WHERE rnc IS NOT NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers viewable by entity users"
  ON public.suppliers FOR SELECT TO authenticated
  USING (user_has_entity_access(entity_id));

CREATE POLICY "Suppliers writable by admin/mgmt/acct/supervisor"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'management'::app_role)
     OR has_role(auth.uid(), 'accountant'::app_role)
     OR has_role(auth.uid(), 'supervisor'::app_role))
    AND user_has_entity_access(entity_id)
  );

CREATE POLICY "Suppliers updatable by admin/mgmt/acct/supervisor"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'management'::app_role)
     OR has_role(auth.uid(), 'accountant'::app_role)
     OR has_role(auth.uid(), 'supervisor'::app_role))
    AND user_has_entity_access(entity_id)
  );

CREATE POLICY "Suppliers deletable by admin"
  ON public.suppliers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Optional FKs to wire suppliers into existing tables
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

ALTER TABLE public.ap_ar_documents
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

CREATE INDEX IF NOT EXISTS idx_transactions_supplier ON public.transactions(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ap_ar_docs_supplier ON public.ap_ar_documents(supplier_id) WHERE supplier_id IS NOT NULL;

-- 3. Helper: open advance balance for a supplier (matches by id OR by RNC for grandfathered rows)
CREATE OR REPLACE FUNCTION public.get_supplier_open_advance_balance(
  p_supplier_id uuid,
  p_entity_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT id, rnc, entity_id FROM public.suppliers WHERE id = p_supplier_id
  )
  SELECT COALESCE(SUM(d.balance_remaining), 0)::numeric
  FROM public.ap_ar_documents d
  JOIN s ON true
  JOIN public.chart_of_accounts c ON c.id = d.account_id
  WHERE d.direction = 'payable'
    AND d.status IN ('open','partial')
    AND d.document_type = 'advance'
    AND c.account_code LIKE '1690%'
    AND (p_entity_id IS NULL OR d.entity_id = p_entity_id)
    AND (
      d.supplier_id = s.id
      OR (s.rnc IS NOT NULL AND d.contact_rnc = s.rnc)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_open_advance_balance(uuid, uuid) TO authenticated;

-- 4. Extend create_transaction_with_ap_ar to accept p_supplier_id (additive, default NULL)
CREATE OR REPLACE FUNCTION public.create_transaction_with_ap_ar(
  p_transaction_date date, p_master_acct_code text, p_description text,
  p_currency text DEFAULT 'DOP', p_amount numeric DEFAULT 0,
  p_project_code text DEFAULT NULL, p_cbs_code text DEFAULT NULL,
  p_purchase_date date DEFAULT NULL, p_itbis numeric DEFAULT 0,
  p_itbis_retenido numeric DEFAULT 0, p_isr_retenido numeric DEFAULT 0,
  p_pay_method text DEFAULT NULL, p_document text DEFAULT NULL,
  p_name text DEFAULT NULL, p_rnc text DEFAULT NULL,
  p_comments text DEFAULT NULL, p_exchange_rate numeric DEFAULT NULL,
  p_is_internal boolean DEFAULT false, p_cost_center text DEFAULT 'general',
  p_transaction_direction text DEFAULT 'purchase',
  p_destination_acct_code text DEFAULT NULL,
  p_dgii_tipo_ingreso text DEFAULT NULL, p_dgii_tipo_bienes_servicios text DEFAULT NULL,
  p_due_date date DEFAULT NULL, p_destination_amount numeric DEFAULT NULL,
  p_itbis_override_reason text DEFAULT NULL, p_entity_id uuid DEFAULT NULL,
  p_ncf_modificado text DEFAULT NULL, p_monto_bienes numeric DEFAULT NULL,
  p_monto_servicios numeric DEFAULT NULL, p_dgii_tipo_retencion_isr text DEFAULT NULL,
  p_isc numeric DEFAULT 0, p_propina_legal numeric DEFAULT 0,
  p_otros_impuestos numeric DEFAULT 0, p_itbis_proporcionalidad numeric DEFAULT 0,
  p_itbis_al_costo numeric DEFAULT 0, p_itbis_percibido numeric DEFAULT 0,
  p_isr_percibido numeric DEFAULT 0,
  p_supplier_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_account_id          UUID;
  v_project_id          UUID;
  v_cbs_id              UUID;
  v_transaction_id      UUID;
  v_legacy_id           INTEGER;
  v_is_advance          BOOLEAN;
  v_should_create_ap_ar BOOLEAN;
  v_direction           TEXT;
  v_acct_code           TEXT;
  v_ap_ar_account_id    UUID;
  v_effective_due_date  DATE;
  v_ap_ar_id            UUID;
  v_bs_type             TEXT;
  v_eff_bienes          NUMERIC;
  v_eff_servicios       NUMERIC;
BEGIN
  SELECT id, dgii_bs_type INTO v_account_id, v_bs_type
  FROM public.chart_of_accounts
  WHERE account_code = p_master_acct_code AND deleted_at IS NULL
  LIMIT 1;

  IF p_project_code IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.projects WHERE code = p_project_code LIMIT 1;
  END IF;
  IF p_cbs_code IS NOT NULL THEN
    SELECT id INTO v_cbs_id FROM public.cbs_codes WHERE code = p_cbs_code LIMIT 1;
  END IF;

  IF p_monto_bienes IS NULL AND p_monto_servicios IS NULL THEN
    IF v_bs_type = 'S' THEN
      v_eff_servicios := ROUND(COALESCE(p_amount,0) - COALESCE(p_itbis,0), 2);
      v_eff_bienes := 0;
    ELSE
      v_eff_bienes := ROUND(COALESCE(p_amount,0) - COALESCE(p_itbis,0), 2);
      v_eff_servicios := 0;
    END IF;
  ELSE
    v_eff_bienes := COALESCE(p_monto_bienes, 0);
    v_eff_servicios := COALESCE(p_monto_servicios, 0);
  END IF;

  INSERT INTO public.transactions (
    transaction_date, master_acct_code, account_id,
    project_code, project_id, cbs_code, cbs_id,
    purchase_date, description, currency, amount,
    itbis, itbis_retenido, isr_retenido,
    pay_method, document, name, rnc, comments,
    exchange_rate, is_void, is_internal, cost_center,
    transaction_direction, destination_acct_code,
    dgii_tipo_ingreso, dgii_tipo_bienes_servicios,
    due_date, destination_amount, itbis_override_reason,
    entity_id,
    ncf_modificado, monto_bienes, monto_servicios,
    dgii_tipo_retencion_isr, isc, propina_legal, otros_impuestos,
    itbis_proporcionalidad, itbis_al_costo, itbis_percibido, isr_percibido,
    supplier_id
  ) VALUES (
    p_transaction_date, p_master_acct_code, v_account_id,
    p_project_code, v_project_id, p_cbs_code, v_cbs_id,
    p_purchase_date, p_description, p_currency, p_amount,
    COALESCE(p_itbis, 0), COALESCE(p_itbis_retenido, 0), COALESCE(p_isr_retenido, 0),
    p_pay_method, p_document, p_name, p_rnc, p_comments,
    p_exchange_rate, false, p_is_internal, p_cost_center,
    p_transaction_direction, p_destination_acct_code,
    p_dgii_tipo_ingreso, p_dgii_tipo_bienes_servicios,
    p_due_date, p_destination_amount, p_itbis_override_reason,
    p_entity_id,
    NULLIF(p_ncf_modificado, ''), v_eff_bienes, v_eff_servicios,
    NULLIF(p_dgii_tipo_retencion_isr, ''),
    COALESCE(p_isc,0), COALESCE(p_propina_legal,0), COALESCE(p_otros_impuestos,0),
    COALESCE(p_itbis_proporcionalidad,0), COALESCE(p_itbis_al_costo,0),
    COALESCE(p_itbis_percibido,0), COALESCE(p_isr_percibido,0),
    p_supplier_id
  )
  RETURNING id, legacy_id INTO v_transaction_id, v_legacy_id;

  v_is_advance := p_master_acct_code LIKE '1690%';
  v_should_create_ap_ar := (
    NOT p_is_internal
    AND p_transaction_direction NOT IN ('payment', 'investment')
    AND (p_due_date IS NOT NULL OR p_pay_method = 'credit' OR v_is_advance)
  );

  IF v_should_create_ap_ar THEN
    v_direction := CASE
      WHEN v_is_advance THEN 'payable'
      WHEN p_transaction_direction = 'sale' THEN 'receivable'
      ELSE 'payable'
    END;

    v_acct_code := CASE
      WHEN v_is_advance THEN '1690'
      WHEN v_direction = 'receivable' THEN '1210'
      ELSE '2101'
    END;

    SELECT id INTO v_ap_ar_account_id
    FROM public.chart_of_accounts
    WHERE account_code = v_acct_code AND allow_posting = true AND deleted_at IS NULL
    LIMIT 1;

    v_effective_due_date := COALESCE(
      p_due_date,
      CASE WHEN p_pay_method = 'credit' THEN p_transaction_date + INTERVAL '30 days' END
    );

    INSERT INTO public.ap_ar_documents (
      direction, document_type, contact_name, contact_rnc,
      document_number, document_date, due_date, currency,
      total_amount, amount_paid, status, notes,
      account_id, entity_id, supplier_id
    ) VALUES (
      v_direction,
      CASE WHEN v_is_advance THEN 'advance' ELSE 'invoice' END,
      COALESCE(NULLIF(TRIM(p_name), ''), p_description),
      NULLIF(TRIM(COALESCE(p_rnc, '')), ''),
      v_legacy_id::TEXT,
      p_transaction_date,
      CASE WHEN v_is_advance THEN NULL ELSE v_effective_due_date END,
      p_currency, p_amount, 0, 'open', p_description,
      v_ap_ar_account_id, p_entity_id, p_supplier_id
    )
    RETURNING id INTO v_ap_ar_id;

    INSERT INTO public.ap_ar_document_transactions (document_id, transaction_id)
    VALUES (v_ap_ar_id, v_transaction_id);
  END IF;

  RETURN jsonb_build_object('id', v_transaction_id, 'legacy_id', v_legacy_id);
END;
$function$;
