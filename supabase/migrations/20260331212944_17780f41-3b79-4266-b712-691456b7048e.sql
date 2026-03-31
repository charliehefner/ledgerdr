
CREATE TABLE public.fixed_asset_depreciation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
  depreciation_amount numeric NOT NULL DEFAULT 0,
  accumulated_at_period_end numeric NOT NULL DEFAULT 0,
  journal_id uuid REFERENCES public.journals(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period_id)
);

ALTER TABLE public.fixed_asset_depreciation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read depreciation entries"
  ON public.fixed_asset_depreciation_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert depreciation entries"
  ON public.fixed_asset_depreciation_entries FOR INSERT TO authenticated WITH CHECK (true);
