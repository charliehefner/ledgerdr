DROP FUNCTION IF EXISTS public.create_transaction_with_ap_ar(date,text,text,text,numeric,text,text,date,numeric,numeric,numeric,text,text,text,text,text,numeric,boolean,text,text,text,text,text,date,numeric,text,uuid);

CREATE FUNCTION public.create_transaction_with_ap_ar(
  p_transaction_date        DATE,
  p_master_acct_code        TEXT,
  p_description             TEXT,
  p_currency                TEXT    DEFAULT 'DOP',
  p_amount                  NUMERIC DEFAULT 0,
  p_project_code            TEXT    DEFAULT NULL,
  p_cbs_code                TEXT    DEFAULT NULL,
  p_purchase_date           DATE    DEFAULT NULL,
  p_itbis                   NUMERIC DEFAULT 0,
  p_itbis_retenido          NUMERIC DEFAULT 0,
  p_isr_retenido            NUMERIC DEFAULT 0,
  p_pay_method              TEXT    DEFAULT NULL,
  p_document                TEXT    DEFAULT NULL,
  p_name                    TEXT    DEFAULT NULL,
  p_rnc                     TEXT    DEFAULT NULL,
  p_comments                TEXT    DEFAULT NULL,
  p_exchange_rate           NUMERIC DEFAULT NULL,
  p_is_internal             BOOLEAN DEFAULT FALSE,
  p_cost_center             TEXT    DEFAULT 'general',
  p_transaction_direction   TEXT    DEFAULT 'purchase',
  p_destination_acct_code   TEXT    DEFAULT NULL,
  p_dgii_tipo_ingreso       TEXT    DEFAULT NULL,
  p_dgii_tipo_bienes_servicios TEXT DEFAULT NULL,
  p_due_date                DATE    DEFAULT NULL,
  p_destination_amount      NUMERIC DEFAULT NULL,
  p_itbis_override_reason   TEXT    DEFAULT NULL,
  p_entity_id               UUID    DEFAULT NULL,
  p_ncf_modificado          TEXT    DEFAULT NULL,
  p_monto_bienes            NUMERIC DEFAULT NULL,
  p_monto_servicios         NUMERIC DEFAULT NULL,
  p_dgii_tipo_retencion_isr TEXT    DEFAULT NULL,
  p_isc                     NUMERIC DEFAULT 0,
  p_propina_legal           NUMERIC DEFAULT 0,
  p_otros_impuestos         NUMERIC DEFAULT 0,
  p_itbis_proporcionalidad  NUMERIC DEFAULT 0,
  p_itbis_al_costo          NUMERIC DEFAULT 0,
  p_itbis_percibido         NUMERIC DEFAULT 0,
  p_isr_percibido           NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      v_eff_bienes    := 0;
    ELSE
      v_eff_bienes    := ROUND(COALESCE(p_amount,0) - COALESCE(p_itbis,0), 2);
      v_eff_servicios := 0;
    END IF;
  ELSE
    v_eff_bienes    := COALESCE(p_monto_bienes, 0);
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
    itbis_proporcionalidad, itbis_al_costo, itbis_percibido, isr_percibido
  )
  VALUES (
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
    COALESCE(p_itbis_percibido,0), COALESCE(p_isr_percibido,0)
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
      account_id, entity_id
    )
    VALUES (
      v_direction,
      CASE WHEN v_is_advance THEN 'advance' ELSE 'invoice' END,
      COALESCE(NULLIF(TRIM(p_name), ''), p_description),
      NULLIF(TRIM(COALESCE(p_rnc, '')), ''),
      v_legacy_id::TEXT,
      p_transaction_date,
      CASE WHEN v_is_advance THEN NULL ELSE v_effective_due_date END,
      p_currency, p_amount, 0, 'open', p_description,
      v_ap_ar_account_id, p_entity_id
    )
    RETURNING id INTO v_ap_ar_id;

    INSERT INTO public.ap_ar_document_transactions (document_id, transaction_id)
    VALUES (v_ap_ar_id, v_transaction_id);
  END IF;

  RETURN jsonb_build_object('id', v_transaction_id, 'legacy_id', v_legacy_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transaction_with_ap_ar TO authenticated;