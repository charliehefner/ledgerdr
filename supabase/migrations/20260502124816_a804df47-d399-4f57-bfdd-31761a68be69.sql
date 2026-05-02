WITH ranked_entries AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        entity_id,
        week_ending_date,
        worker_type,
        COALESCE(worker_id::text, worker_name),
        day_of_week,
        time_slot
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS keep_rank
  FROM public.cronograma_entries
)
DELETE FROM public.cronograma_entries ce
USING ranked_entries re
WHERE ce.id = re.id
  AND re.keep_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cronograma_entries_unique_cell
ON public.cronograma_entries (
  entity_id,
  week_ending_date,
  worker_type,
  COALESCE(worker_id::text, worker_name),
  day_of_week,
  time_slot
);