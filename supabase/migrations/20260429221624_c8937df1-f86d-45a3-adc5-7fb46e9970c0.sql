-- Hide transactions with description exactly 'Contract Charles' or 'Contract Iramaia'
-- from users with the 'office' role only. All other roles unaffected.
-- Match is case-insensitive and ignores leading/trailing whitespace.

-- ============ transactions ============
DROP POLICY IF EXISTS "entity_select_transactions" ON public.transactions;
DROP POLICY IF EXISTS "Viewer can view" ON public.transactions;

CREATE POLICY "entity_select_transactions"
ON public.transactions
FOR SELECT
USING (
  user_has_entity_access(entity_id)
  AND (
    NOT has_role(auth.uid(), 'office'::app_role)
    OR lower(btrim(description)) NOT IN ('contract charles', 'contract iramaia')
  )
);

CREATE POLICY "Viewer can view"
ON public.transactions
FOR SELECT
USING (
  has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id)
  AND (
    NOT has_role(auth.uid(), 'office'::app_role)
    OR lower(btrim(description)) NOT IN ('contract charles', 'contract iramaia')
  )
);

-- ============ journals ============
DROP POLICY IF EXISTS "entity_select_journals" ON public.journals;
DROP POLICY IF EXISTS "Viewer can view" ON public.journals;
DROP POLICY IF EXISTS "office_read_journals" ON public.journals;

CREATE POLICY "entity_select_journals"
ON public.journals
FOR SELECT
USING (
  user_has_entity_access(entity_id)
  AND (
    NOT has_role(auth.uid(), 'office'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = journals.transaction_source_id
        AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
    )
  )
);

CREATE POLICY "Viewer can view"
ON public.journals
FOR SELECT
USING (
  has_role_for_entity(auth.uid(), 'viewer'::app_role, entity_id)
  AND (
    NOT has_role(auth.uid(), 'office'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = journals.transaction_source_id
        AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
    )
  )
);

CREATE POLICY "office_read_journals"
ON public.journals
FOR SELECT
USING (
  has_role(auth.uid(), 'office'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = journals.transaction_source_id
      AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
  )
);

-- ============ journal_lines ============
DROP POLICY IF EXISTS "entity_select_journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Viewer can view" ON public.journal_lines;
DROP POLICY IF EXISTS "office_read_journal_lines" ON public.journal_lines;

CREATE POLICY "entity_select_journal_lines"
ON public.journal_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_lines.journal_id
      AND user_has_entity_access(j.entity_id)
      AND (
        NOT has_role(auth.uid(), 'office'::app_role)
        OR NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = j.transaction_source_id
            AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
        )
      )
  )
);

CREATE POLICY "Viewer can view"
ON public.journal_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_lines.journal_id
      AND has_role_for_entity(auth.uid(), 'viewer'::app_role, j.entity_id)
      AND (
        NOT has_role(auth.uid(), 'office'::app_role)
        OR NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = j.transaction_source_id
            AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
        )
      )
  )
);

CREATE POLICY "office_read_journal_lines"
ON public.journal_lines
FOR SELECT
USING (
  has_role(auth.uid(), 'office'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_lines.journal_id
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id = j.transaction_source_id
          AND lower(btrim(t.description)) IN ('contract charles', 'contract iramaia')
      )
  )
);