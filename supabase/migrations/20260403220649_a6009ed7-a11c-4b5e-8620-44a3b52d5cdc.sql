INSERT INTO public.alert_configurations (alert_type, is_active, threshold_value)
VALUES 
  ('ap_ar_overdue', true, 0),
  ('payroll_period_approaching', true, 3)
ON CONFLICT DO NOTHING;