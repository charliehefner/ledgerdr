-- Audit trail for cronograma_entries
CREATE TABLE IF NOT EXISTS public.cronograma_entries_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL,
  entity_id uuid,
  week_ending_date date NOT NULL,
  worker_type text NOT NULL,
  worker_id uuid,
  worker_name text NOT NULL,
  day_of_week int NOT NULL,
  time_slot text NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  old_task text,
  new_task text,
  old_is_vacation boolean,
  new_is_vacation boolean,
  old_is_holiday boolean,
  new_is_holiday boolean,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cronograma_audit_entry_id ON public.cronograma_entries_audit(entry_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_audit_week_entity ON public.cronograma_entries_audit(entity_id, week_ending_date);
CREATE INDEX IF NOT EXISTS idx_cronograma_audit_changed_at ON public.cronograma_entries_audit(changed_at DESC);

ALTER TABLE public.cronograma_entries_audit ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user that can read cronograma_entries can read its audit
-- (mirrors the existing cronograma RLS — read access is permissive for the team)
CREATE POLICY "Authenticated can view cronograma audit"
  ON public.cronograma_entries_audit
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER trigger can write.

-- Trigger function
CREATE OR REPLACE FUNCTION public.tg_cronograma_entries_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.cronograma_entries_audit(
      entry_id, entity_id, week_ending_date, worker_type, worker_id, worker_name,
      day_of_week, time_slot, action,
      old_task, new_task, old_is_vacation, new_is_vacation, old_is_holiday, new_is_holiday,
      changed_by, changed_at
    ) VALUES (
      NEW.id, NEW.entity_id, NEW.week_ending_date, NEW.worker_type, NEW.worker_id, NEW.worker_name,
      NEW.day_of_week, NEW.time_slot, 'insert',
      NULL, NEW.task, NULL, NEW.is_vacation, NULL, NEW.is_holiday,
      COALESCE(NEW.updated_by, NEW.created_by), COALESCE(NEW.updated_at, NEW.created_at, now())
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Skip when nothing meaningful changed
    IF OLD.task IS NOT DISTINCT FROM NEW.task
       AND OLD.is_vacation IS NOT DISTINCT FROM NEW.is_vacation
       AND OLD.is_holiday IS NOT DISTINCT FROM NEW.is_holiday THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.cronograma_entries_audit(
      entry_id, entity_id, week_ending_date, worker_type, worker_id, worker_name,
      day_of_week, time_slot, action,
      old_task, new_task, old_is_vacation, new_is_vacation, old_is_holiday, new_is_holiday,
      changed_by, changed_at
    ) VALUES (
      NEW.id, NEW.entity_id, NEW.week_ending_date, NEW.worker_type, NEW.worker_id, NEW.worker_name,
      NEW.day_of_week, NEW.time_slot, 'update',
      OLD.task, NEW.task, OLD.is_vacation, NEW.is_vacation, OLD.is_holiday, NEW.is_holiday,
      COALESCE(NEW.updated_by, NEW.created_by), COALESCE(NEW.updated_at, now())
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.cronograma_entries_audit(
      entry_id, entity_id, week_ending_date, worker_type, worker_id, worker_name,
      day_of_week, time_slot, action,
      old_task, new_task, old_is_vacation, new_is_vacation, old_is_holiday, new_is_holiday,
      changed_by, changed_at
    ) VALUES (
      OLD.id, OLD.entity_id, OLD.week_ending_date, OLD.worker_type, OLD.worker_id, OLD.worker_name,
      OLD.day_of_week, OLD.time_slot, 'delete',
      OLD.task, NULL, OLD.is_vacation, NULL, OLD.is_holiday, NULL,
      COALESCE(OLD.updated_by, OLD.created_by), now()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cronograma_entries_audit_trg ON public.cronograma_entries;
CREATE TRIGGER cronograma_entries_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.cronograma_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_cronograma_entries_audit();

-- Backfill: one synthetic 'insert' row per existing entry, plus 'update' if updated_at <> created_at
INSERT INTO public.cronograma_entries_audit(
  entry_id, entity_id, week_ending_date, worker_type, worker_id, worker_name,
  day_of_week, time_slot, action,
  old_task, new_task, old_is_vacation, new_is_vacation, old_is_holiday, new_is_holiday,
  changed_by, changed_at
)
SELECT e.id, e.entity_id, e.week_ending_date, e.worker_type, e.worker_id, e.worker_name,
       e.day_of_week, e.time_slot, 'insert',
       NULL, e.task, NULL, e.is_vacation, NULL, e.is_holiday,
       e.created_by, COALESCE(e.created_at, e.updated_at, now())
FROM public.cronograma_entries e
WHERE NOT EXISTS (
  SELECT 1 FROM public.cronograma_entries_audit a
  WHERE a.entry_id = e.id AND a.action = 'insert'
);

INSERT INTO public.cronograma_entries_audit(
  entry_id, entity_id, week_ending_date, worker_type, worker_id, worker_name,
  day_of_week, time_slot, action,
  old_task, new_task, old_is_vacation, new_is_vacation, old_is_holiday, new_is_holiday,
  changed_by, changed_at
)
SELECT e.id, e.entity_id, e.week_ending_date, e.worker_type, e.worker_id, e.worker_name,
       e.day_of_week, e.time_slot, 'update',
       e.task, e.task, e.is_vacation, e.is_vacation, e.is_holiday, e.is_holiday,
       e.updated_by, e.updated_at
FROM public.cronograma_entries e
WHERE e.updated_at IS NOT NULL
  AND e.created_at IS NOT NULL
  AND e.updated_at <> e.created_at
  AND e.updated_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cronograma_entries_audit a
    WHERE a.entry_id = e.id AND a.action = 'update'
  );