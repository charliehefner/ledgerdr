
-- 1. Asset depreciation rules reference table
CREATE TABLE public.asset_depreciation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL UNIQUE,
  asset_account_code text,
  depreciation_expense_account text,
  accumulated_depreciation_account text
);

ALTER TABLE public.asset_depreciation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to depreciation rules" ON public.asset_depreciation_rules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to depreciation rules" ON public.asset_depreciation_rules FOR ALL USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Accountants can manage depreciation rules" ON public.asset_depreciation_rules FOR ALL USING (has_role(auth.uid(), 'accountant'::app_role)) WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Supervisors can view depreciation rules" ON public.asset_depreciation_rules FOR SELECT USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Viewers can view depreciation rules" ON public.asset_depreciation_rules FOR SELECT USING (has_role(auth.uid(), 'viewer'::app_role));

-- Seed depreciation rules
INSERT INTO public.asset_depreciation_rules (category, asset_account_code, depreciation_expense_account, accumulated_depreciation_account) VALUES
  ('vehicle', '1240', '5631', '1241'),
  ('tractor', '1240', '5631', '1241'),
  ('implement', '1220', '5632', '1221'),
  ('building', '1110', '5633', '1111'),
  ('tools', '1220', '5634', '1221'),
  ('container', '1220', '5635', '1221'),
  ('office', '1250', '5636', '1251'),
  ('computer', '1250', '5637', '1251'),
  ('solar_panel', '1260', '5638', '1261'),
  ('land_improvement', '1150', '5639', '1151'),
  ('other', '1290', '5640', '1291');

-- 2. Fixed assets table
CREATE TABLE public.fixed_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  acquisition_date date,
  acquisition_value numeric(18,2) NOT NULL DEFAULT 0,
  salvage_value numeric(18,2) NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 5,
  depreciation_method text NOT NULL DEFAULT 'straight_line',
  accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0,
  in_service_date date,
  disposal_date date,
  disposal_value numeric(18,2),
  is_active boolean NOT NULL DEFAULT true,
  asset_account_code text,
  depreciation_expense_account text,
  accumulated_depreciation_account text,
  source_project_id uuid REFERENCES public.projects(id),
  equipment_id uuid REFERENCES public.fuel_equipment(id),
  implement_id uuid REFERENCES public.implements(id),
  serial_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to fixed assets" ON public.fixed_assets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to fixed assets" ON public.fixed_assets FOR ALL USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Accountants can manage fixed assets" ON public.fixed_assets FOR ALL USING (has_role(auth.uid(), 'accountant'::app_role)) WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Supervisors can view fixed assets" ON public.fixed_assets FOR SELECT USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Viewers can view fixed assets" ON public.fixed_assets FOR SELECT USING (has_role(auth.uid(), 'viewer'::app_role));

-- Auto-number trigger for asset_code
CREATE SEQUENCE IF NOT EXISTS fixed_assets_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_asset_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  seq_num bigint;
BEGIN
  IF NEW.asset_code IS NULL THEN
    SELECT nextval('fixed_assets_code_seq') INTO seq_num;
    NEW.asset_code = 'FA-' || LPAD(seq_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_asset_code
  BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_asset_code();

-- Updated_at trigger
CREATE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Depreciation schedule table
CREATE TABLE public.depreciation_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_date date NOT NULL,
  depreciation_amount numeric(18,2) NOT NULL DEFAULT 0,
  journal_id uuid REFERENCES public.journals(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to depreciation schedule" ON public.depreciation_schedule FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Management has full access to depreciation schedule" ON public.depreciation_schedule FOR ALL USING (has_role(auth.uid(), 'management'::app_role)) WITH CHECK (has_role(auth.uid(), 'management'::app_role));
CREATE POLICY "Accountants can manage depreciation schedule" ON public.depreciation_schedule FOR ALL USING (has_role(auth.uid(), 'accountant'::app_role)) WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Supervisors can view depreciation schedule" ON public.depreciation_schedule FOR SELECT USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Viewers can view depreciation schedule" ON public.depreciation_schedule FOR SELECT USING (has_role(auth.uid(), 'viewer'::app_role));

-- Import tractors/vehicles from fuel_equipment
INSERT INTO public.fixed_assets (name, category, acquisition_date, acquisition_value, serial_number, equipment_id, asset_account_code, depreciation_expense_account, accumulated_depreciation_account)
SELECT 
  fe.name,
  CASE WHEN fe.equipment_type = 'vehicle' OR fe.name ILIKE '%volvo%' OR fe.name ILIKE '%pala%' THEN 'vehicle' ELSE 'tractor' END,
  fe.purchase_date,
  COALESCE(fe.purchase_price, 0),
  fe.serial_number,
  fe.id,
  CASE WHEN fe.equipment_type = 'vehicle' OR fe.name ILIKE '%volvo%' OR fe.name ILIKE '%pala%' THEN '1240' ELSE '1240' END,
  '5631',
  '1241'
FROM public.fuel_equipment fe
WHERE fe.is_active = true;

-- Import implements
INSERT INTO public.fixed_assets (name, category, acquisition_date, acquisition_value, serial_number, implement_id, asset_account_code, depreciation_expense_account, accumulated_depreciation_account)
SELECT 
  i.name,
  'implement',
  i.purchase_date,
  COALESCE(i.purchase_price, 0),
  i.serial_number,
  i.id,
  '1220',
  '5632',
  '1221'
FROM public.implements i
WHERE i.is_active = true;

-- Import fuel tanks as containers
INSERT INTO public.fixed_assets (name, category, asset_account_code, depreciation_expense_account, accumulated_depreciation_account)
SELECT 
  ft.name,
  'container',
  '1220',
  '5635',
  '1221'
FROM public.fuel_tanks ft
WHERE ft.is_active = true;
