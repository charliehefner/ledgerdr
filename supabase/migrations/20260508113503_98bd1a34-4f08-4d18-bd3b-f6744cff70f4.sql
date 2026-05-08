
-- ============================================================
-- #16 Purchase Order Module (Three-Way Match)
-- ============================================================

CREATE TABLE public.purchasing_settings (
  entity_id uuid PRIMARY KEY REFERENCES public.entities(id) ON DELETE CASCADE,
  qty_tolerance_pct numeric NOT NULL DEFAULT 5,
  price_tolerance_pct numeric NOT NULL DEFAULT 5,
  three_way_required boolean NOT NULL DEFAULT false,
  next_po_number integer NOT NULL DEFAULT 1,
  next_gr_number integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchasing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_admin" ON public.purchasing_settings FOR ALL
  USING (has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'admin'::app_role, entity_id));
CREATE POLICY "ps_mgmt" ON public.purchasing_settings FOR ALL
  USING (has_role_for_entity(auth.uid(), 'management'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'management'::app_role, entity_id));
CREATE POLICY "ps_acct" ON public.purchasing_settings FOR ALL
  USING (has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'accountant'::app_role, entity_id));
CREATE POLICY "ps_read" ON public.purchasing_settings FOR SELECT
  USING (
    has_role_for_entity(auth.uid(), 'supervisor'::app_role, entity_id)
    OR has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id)
  );

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL DEFAULT current_user_entity_id() REFERENCES public.entities(id),
  po_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  contact_name text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','partially_received','received','closed','cancelled')),
  currency text NOT NULL DEFAULT 'DOP',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, po_number)
);
CREATE INDEX idx_po_entity ON public.purchase_orders(entity_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_admin" ON public.purchase_orders FOR ALL
  USING (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id));
CREATE POLICY "po_mgmt" ON public.purchase_orders FOR ALL
  USING (has_role_for_entity(auth.uid(),'management'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'management'::app_role,entity_id));
CREATE POLICY "po_acct" ON public.purchase_orders FOR ALL
  USING (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id));
CREATE POLICY "po_sup" ON public.purchase_orders FOR ALL
  USING (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id));
CREATE POLICY "po_view" ON public.purchase_orders FOR SELECT
  USING (has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id));

CREATE TABLE public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid REFERENCES public.inventory_items(id),
  description text NOT NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id),
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  qty_invoiced numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS (ROUND(qty_ordered * unit_price * (1 + tax_rate/100), 4)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (po_id, line_no)
);
CREATE INDEX idx_pol_po ON public.purchase_order_lines(po_id);

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol_all" ON public.purchase_order_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND (
    has_role_for_entity(auth.uid(),'admin'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'management'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'accountant'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'supervisor'::app_role,po.entity_id)
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND (
    has_role_for_entity(auth.uid(),'admin'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'management'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'accountant'::app_role,po.entity_id)
    OR has_role_for_entity(auth.uid(),'supervisor'::app_role,po.entity_id)
  )));
CREATE POLICY "pol_view" ON public.purchase_order_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND
    has_role_for_entity(auth.uid(),'viewer'::app_role,po.entity_id)
  ));

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL DEFAULT current_user_entity_id() REFERENCES public.entities(id),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  gr_number text NOT NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  received_by uuid DEFAULT auth.uid(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, gr_number)
);
CREATE INDEX idx_gr_po ON public.goods_receipts(po_id);

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr_admin" ON public.goods_receipts FOR ALL
  USING (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'admin'::app_role,entity_id));
CREATE POLICY "gr_mgmt" ON public.goods_receipts FOR ALL
  USING (has_role_for_entity(auth.uid(),'management'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'management'::app_role,entity_id));
CREATE POLICY "gr_acct" ON public.goods_receipts FOR ALL
  USING (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'accountant'::app_role,entity_id));
CREATE POLICY "gr_sup" ON public.goods_receipts FOR ALL
  USING (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(),'supervisor'::app_role,entity_id));
CREATE POLICY "gr_view" ON public.goods_receipts FOR SELECT
  USING (has_role_for_entity(auth.uid(),'viewer'::app_role,entity_id));

CREATE TABLE public.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  po_line_id uuid NOT NULL REFERENCES public.purchase_order_lines(id) ON DELETE RESTRICT,
  qty_received numeric NOT NULL CHECK (qty_received >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_grl_gr ON public.goods_receipt_lines(gr_id);
CREATE INDEX idx_grl_pol ON public.goods_receipt_lines(po_line_id);

ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grl_all" ON public.goods_receipt_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.goods_receipts gr WHERE gr.id = gr_id AND (
    has_role_for_entity(auth.uid(),'admin'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'management'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'accountant'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'supervisor'::app_role,gr.entity_id)
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.goods_receipts gr WHERE gr.id = gr_id AND (
    has_role_for_entity(auth.uid(),'admin'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'management'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'accountant'::app_role,gr.entity_id)
    OR has_role_for_entity(auth.uid(),'supervisor'::app_role,gr.entity_id)
  )));
CREATE POLICY "grl_view" ON public.goods_receipt_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.goods_receipts gr WHERE gr.id = gr_id AND
    has_role_for_entity(auth.uid(),'viewer'::app_role,gr.entity_id)));

ALTER TABLE public.ap_ar_documents
  ADD COLUMN po_id uuid REFERENCES public.purchase_orders(id),
  ADD COLUMN gr_id uuid REFERENCES public.goods_receipts(id),
  ADD COLUMN match_status text NOT NULL DEFAULT 'not_applicable' CHECK (match_status IN ('not_applicable','matched','variance','awaiting_receipt'));
CREATE INDEX idx_apar_po ON public.ap_ar_documents(po_id) WHERE po_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_purchasing_settings(p_entity_id uuid)
RETURNS public.purchasing_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.purchasing_settings;
BEGIN
  INSERT INTO public.purchasing_settings(entity_id) VALUES (p_entity_id)
    ON CONFLICT (entity_id) DO NOTHING;
  SELECT * INTO r FROM public.purchasing_settings WHERE entity_id = p_entity_id;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_entity_id uuid,
  p_supplier_id uuid,
  p_contact_name text,
  p_currency text DEFAULT 'DOP',
  p_order_date date DEFAULT CURRENT_DATE,
  p_expected_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.purchasing_settings;
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_line_no int := 0;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
BEGIN
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Purchase order must have at least one line';
  END IF;

  v_settings := public.ensure_purchasing_settings(p_entity_id);
  v_po_number := 'PO-' || LPAD(v_settings.next_po_number::text, 6, '0');

  UPDATE public.purchasing_settings
    SET next_po_number = next_po_number + 1, updated_at = now()
    WHERE entity_id = p_entity_id;

  INSERT INTO public.purchase_orders(
    entity_id, po_number, supplier_id, contact_name, currency,
    order_date, expected_date, notes
  ) VALUES (
    p_entity_id, v_po_number, p_supplier_id, p_contact_name, p_currency,
    p_order_date, p_expected_date, p_notes
  ) RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO public.purchase_order_lines(
      po_id, line_no, item_id, description, account_id,
      qty_ordered, unit_price, tax_rate
    ) VALUES (
      v_po_id, v_line_no,
      NULLIF(v_line->>'item_id','')::uuid,
      COALESCE(v_line->>'description',''),
      NULLIF(v_line->>'account_id','')::uuid,
      COALESCE((v_line->>'qty_ordered')::numeric, 0),
      COALESCE((v_line->>'unit_price')::numeric, 0),
      COALESCE((v_line->>'tax_rate')::numeric, 0)
    );
  END LOOP;

  SELECT
    COALESCE(SUM(ROUND(qty_ordered * unit_price, 4)), 0),
    COALESCE(SUM(ROUND(qty_ordered * unit_price * tax_rate / 100, 4)), 0)
  INTO v_subtotal, v_tax
  FROM public.purchase_order_lines WHERE po_id = v_po_id;

  UPDATE public.purchase_orders
    SET subtotal = v_subtotal,
        tax_total = v_tax,
        total = ROUND(v_subtotal + v_tax, 4),
        updated_at = now()
    WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gr_line_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_pol public.purchase_order_lines;
  v_po_entity uuid;
  v_settings public.purchasing_settings;
  v_max_allowed numeric;
  v_total_recv numeric;
  v_total_ord numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_pol FROM public.purchase_order_lines WHERE id = NEW.po_line_id FOR UPDATE;
    SELECT entity_id INTO v_po_entity FROM public.purchase_orders WHERE id = v_pol.po_id;
    v_settings := public.ensure_purchasing_settings(v_po_entity);
    v_max_allowed := ROUND(v_pol.qty_ordered * (1 + v_settings.qty_tolerance_pct/100), 4);
    IF ROUND(v_pol.qty_received + NEW.qty_received, 4) > v_max_allowed THEN
      RAISE EXCEPTION 'Receipt of % on line % exceeds ordered qty % plus tolerance',
        NEW.qty_received, v_pol.line_no, v_pol.qty_ordered;
    END IF;
    UPDATE public.purchase_order_lines
      SET qty_received = ROUND(qty_received + NEW.qty_received, 4)
      WHERE id = NEW.po_line_id;
    v_po_id := v_pol.po_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.purchase_order_lines
      SET qty_received = ROUND(qty_received - OLD.qty_received, 4)
      WHERE id = OLD.po_line_id;
    SELECT po_id INTO v_po_id FROM public.purchase_order_lines WHERE id = OLD.po_line_id;
  END IF;

  SELECT COALESCE(SUM(qty_ordered),0), COALESCE(SUM(qty_received),0)
  INTO v_total_ord, v_total_recv
  FROM public.purchase_order_lines WHERE po_id = v_po_id;

  UPDATE public.purchase_orders
    SET status = CASE
      WHEN status IN ('cancelled','closed') THEN status
      WHEN v_total_recv >= v_total_ord AND v_total_ord > 0 THEN 'received'
      WHEN v_total_recv > 0 THEN 'partially_received'
      ELSE 'open'
    END,
    updated_at = now()
    WHERE id = v_po_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_gr_line_after_change
AFTER INSERT OR DELETE ON public.goods_receipt_lines
FOR EACH ROW EXECUTE FUNCTION public.gr_line_after_change();

CREATE OR REPLACE FUNCTION public.receive_goods(
  p_entity_id uuid,
  p_po_id uuid,
  p_received_date date,
  p_notes text,
  p_lines jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.purchasing_settings;
  v_gr_id uuid;
  v_gr_number text;
  v_line jsonb;
  v_count int := 0;
BEGIN
  v_settings := public.ensure_purchasing_settings(p_entity_id);
  v_gr_number := 'GR-' || LPAD(v_settings.next_gr_number::text, 6, '0');

  UPDATE public.purchasing_settings
    SET next_gr_number = next_gr_number + 1, updated_at = now()
    WHERE entity_id = p_entity_id;

  INSERT INTO public.goods_receipts(entity_id, po_id, gr_number, received_date, notes)
  VALUES (p_entity_id, p_po_id, v_gr_number, COALESCE(p_received_date, CURRENT_DATE), p_notes)
  RETURNING id INTO v_gr_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE((v_line->>'qty_received')::numeric, 0) > 0 THEN
      INSERT INTO public.goods_receipt_lines(gr_id, po_line_id, qty_received, notes)
      VALUES (v_gr_id, (v_line->>'po_line_id')::uuid,
              (v_line->>'qty_received')::numeric, v_line->>'notes');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Goods receipt must have at least one line with qty > 0';
  END IF;

  RETURN v_gr_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_po_invoice_match(p_apar_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.ap_ar_documents;
  v_settings public.purchasing_settings;
  v_total_received_value numeric;
  v_already_invoiced numeric;
  v_max_allowed numeric;
  v_status text;
BEGIN
  SELECT * INTO v_doc FROM public.ap_ar_documents WHERE id = p_apar_id;
  IF v_doc.po_id IS NULL THEN
    UPDATE public.ap_ar_documents SET match_status = 'not_applicable' WHERE id = p_apar_id;
    RETURN 'not_applicable';
  END IF;

  v_settings := public.ensure_purchasing_settings(v_doc.entity_id);

  SELECT COALESCE(SUM(ROUND(qty_received * unit_price * (1 + tax_rate/100), 4)), 0)
  INTO v_total_received_value
  FROM public.purchase_order_lines WHERE po_id = v_doc.po_id;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_already_invoiced
  FROM public.ap_ar_documents
  WHERE po_id = v_doc.po_id AND id <> p_apar_id AND status <> 'void';

  IF v_settings.three_way_required AND v_total_received_value = 0 THEN
    v_status := 'awaiting_receipt';
  ELSE
    v_max_allowed := ROUND(v_total_received_value * (1 + v_settings.price_tolerance_pct/100), 4);
    IF v_settings.three_way_required AND ROUND(v_already_invoiced + v_doc.total_amount, 4) > v_max_allowed THEN
      RAISE EXCEPTION 'Invoice cumulative total % exceeds received value % plus tolerance',
        ROUND(v_already_invoiced + v_doc.total_amount, 4), v_total_received_value;
    END IF;
    IF ABS(v_doc.total_amount - GREATEST(v_total_received_value - v_already_invoiced, 0))
       > ROUND(GREATEST(v_total_received_value, v_doc.total_amount) * v_settings.price_tolerance_pct/100, 4) THEN
      v_status := 'variance';
    ELSE
      v_status := 'matched';
    END IF;
  END IF;

  UPDATE public.ap_ar_documents SET match_status = v_status WHERE id = p_apar_id;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_received numeric; v_invoiced int;
BEGIN
  SELECT COALESCE(SUM(qty_received),0) INTO v_received
  FROM public.purchase_order_lines WHERE po_id = p_po_id;
  SELECT COUNT(*) INTO v_invoiced FROM public.ap_ar_documents WHERE po_id = p_po_id AND status <> 'void';
  IF v_received > 0 OR v_invoiced > 0 THEN
    RAISE EXCEPTION 'Cannot cancel PO with receipts or invoices';
  END IF;
  UPDATE public.purchase_orders SET status = 'cancelled', updated_at = now() WHERE id = p_po_id;
END;
$$;
