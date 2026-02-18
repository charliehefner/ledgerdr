
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS dgii_tipo_bienes_servicios text,
  ADD COLUMN IF NOT EXISTS itbis_retenido numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS isr_retenido numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dgii_tipo_ingreso text,
  ADD COLUMN IF NOT EXISTS dgii_tipo_anulacion text,
  ADD COLUMN IF NOT EXISTS transaction_direction text DEFAULT 'purchase';
