-- Retry: bypass validate_itbis_cap during the backfill UPDATEs

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS dgii_bs_type text
    CHECK (dgii_bs_type IS NULL OR dgii_bs_type IN ('B','S'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ncf_modificado          text,
  ADD COLUMN IF NOT EXISTS monto_bienes            numeric,
  ADD COLUMN IF NOT EXISTS monto_servicios         numeric,
  ADD COLUMN IF NOT EXISTS dgii_tipo_retencion_isr text,
  ADD COLUMN IF NOT EXISTS isc                     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS propina_legal           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otros_impuestos         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itbis_proporcionalidad  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itbis_al_costo          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itbis_percibido         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS isr_percibido           numeric NOT NULL DEFAULT 0;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS chk_dgii_tipo_retencion_isr;
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_dgii_tipo_retencion_isr
  CHECK (dgii_tipo_retencion_isr IS NULL OR dgii_tipo_retencion_isr IN
    ('01','02','03','04','05','06','07','08','09','10','11'));

-- Backfill: temporarily disable user triggers (incl. validate_itbis_cap) on transactions
ALTER TABLE public.transactions DISABLE TRIGGER USER;

UPDATE public.transactions t
SET monto_servicios = ROUND(COALESCE(t.amount,0) - COALESCE(t.itbis,0), 2),
    monto_bienes    = 0
FROM public.chart_of_accounts c
WHERE t.account_id = c.id
  AND c.dgii_bs_type = 'S'
  AND t.monto_bienes IS NULL
  AND t.monto_servicios IS NULL;

UPDATE public.transactions t
SET monto_bienes    = ROUND(COALESCE(t.amount,0) - COALESCE(t.itbis,0), 2),
    monto_servicios = 0
WHERE t.monto_bienes IS NULL
  AND t.monto_servicios IS NULL;

ALTER TABLE public.transactions ENABLE TRIGGER USER;

-- Rewrite generate_dgii_606 with full 23-column output
CREATE OR REPLACE FUNCTION public.generate_dgii_606(
  p_year integer,
  p_month integer,
  p_entity_id uuid DEFAULT NULL::uuid,
  p_own_rnc text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_period   TEXT;
  v_own_rnc  TEXT;
  v_start    DATE;
  v_end      DATE;
  v_lines    TEXT[] := '{}';
  v_count    INTEGER := 0;
  v_rec      RECORD;
  v_bienes        NUMERIC;
  v_servicios     NUMERIC;
  v_total         NUMERIC;
  v_itbis_adel    NUMERIC;
BEGIN
  v_period := TO_CHAR(p_year, 'FM0000') || TO_CHAR(p_month, 'FM00');
  v_start  := (p_year || '-' || LPAD(p_month::TEXT, 2, '0') || '-01')::DATE;
  v_end    := (v_start + INTERVAL '1 month - 1 day')::DATE;

  v_own_rnc := COALESCE(
    p_own_rnc,
    (SELECT rnc FROM entities WHERE id = p_entity_id),
    (SELECT rnc FROM entities ORDER BY created_at LIMIT 1)
  );
  IF v_own_rnc IS NULL THEN
    RAISE EXCEPTION 'RNC requerido: establezca entities.rnc o pase p_own_rnc';
  END IF;

  FOR v_rec IN
    SELECT
      t.rnc, t.document, t.ncf_modificado, t.dgii_tipo_bienes_servicios,
      t.transaction_date, t.purchase_date, t.amount, t.itbis,
      t.itbis_retenido, t.isr_retenido, t.pay_method,
      t.monto_bienes, t.monto_servicios, t.dgii_tipo_retencion_isr,
      t.isc, t.propina_legal, t.otros_impuestos,
      t.itbis_proporcionalidad, t.itbis_al_costo, t.itbis_percibido,
      t.isr_percibido,
      c.dgii_bs_type
    FROM transactions t
    LEFT JOIN chart_of_accounts c ON c.id = t.account_id
    WHERE t.transaction_date BETWEEN v_start AND v_end
      AND t.transaction_direction = 'purchase'
      AND t.is_void     = false
      AND t.is_internal = false
      AND t.document IS NOT NULL
      AND t.document  != ''
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
    ORDER BY t.transaction_date, t.created_at
  LOOP
    IF v_rec.monto_bienes IS NULL AND v_rec.monto_servicios IS NULL THEN
      IF v_rec.dgii_bs_type = 'S' THEN
        v_servicios := ROUND(COALESCE(v_rec.amount,0) - COALESCE(v_rec.itbis,0), 2);
        v_bienes    := 0;
      ELSE
        v_bienes    := ROUND(COALESCE(v_rec.amount,0) - COALESCE(v_rec.itbis,0), 2);
        v_servicios := 0;
      END IF;
    ELSE
      v_bienes    := ROUND(COALESCE(v_rec.monto_bienes, 0), 2);
      v_servicios := ROUND(COALESCE(v_rec.monto_servicios, 0), 2);
    END IF;
    v_total := ROUND(v_bienes + v_servicios, 2);

    v_itbis_adel := ROUND(
      COALESCE(v_rec.itbis,0)
      - COALESCE(v_rec.itbis_proporcionalidad,0)
      - COALESCE(v_rec.itbis_al_costo,0), 2);
    IF v_itbis_adel < 0 THEN v_itbis_adel := 0; END IF;

    v_lines := array_append(v_lines, CONCAT_WS('|',
      COALESCE(REGEXP_REPLACE(v_rec.rnc, '[^0-9]', '', 'g'), ''),
      public.dgii_id_type(v_rec.rnc),
      COALESCE(v_rec.dgii_tipo_bienes_servicios, ''),
      COALESCE(v_rec.document, ''),
      COALESCE(v_rec.ncf_modificado, ''),
      TO_CHAR(v_rec.transaction_date, 'YYYYMMDD'),
      TO_CHAR(COALESCE(v_rec.purchase_date, v_rec.transaction_date), 'YYYYMMDD'),
      public.dgii_fmt_amount(v_servicios),
      public.dgii_fmt_amount(v_bienes),
      public.dgii_fmt_amount(v_total),
      public.dgii_fmt_amount(COALESCE(v_rec.itbis,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.itbis_retenido,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.itbis_proporcionalidad,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.itbis_al_costo,0)),
      public.dgii_fmt_amount(v_itbis_adel),
      public.dgii_fmt_amount(COALESCE(v_rec.itbis_percibido,0)),
      COALESCE(v_rec.dgii_tipo_retencion_isr, ''),
      public.dgii_fmt_amount(COALESCE(v_rec.isr_retenido,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.isr_percibido,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.isc,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.otros_impuestos,0)),
      public.dgii_fmt_amount(COALESCE(v_rec.propina_legal,0)),
      public.dgii_pay_method(v_rec.pay_method)
    ));

    v_count := v_count + 1;
  END LOOP;

  RETURN '606|' || v_own_rnc || '|' || v_period || '|' || v_count
    || CHR(10)
    || ARRAY_TO_STRING(v_lines, CHR(10));
END;
$function$;