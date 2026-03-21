-- Insert any missing week rows so the FK won't be violated
INSERT INTO public.cronograma_weeks (week_ending_date)
SELECT DISTINCT ce.week_ending_date
FROM public.cronograma_entries ce
WHERE NOT EXISTS (
  SELECT 1 FROM public.cronograma_weeks cw
  WHERE cw.week_ending_date = ce.week_ending_date
)
ON CONFLICT (week_ending_date) DO NOTHING;

-- Now add the FK constraint
ALTER TABLE public.cronograma_entries
  ADD CONSTRAINT fk_cronograma_entries_week
  FOREIGN KEY (week_ending_date) REFERENCES public.cronograma_weeks(week_ending_date)
  ON DELETE RESTRICT;