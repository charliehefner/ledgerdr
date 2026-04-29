-- Extend hidden descriptions to include Spanish "Contrato" variants
-- Drop and recreate the three office-restrictive policies

DROP POLICY IF EXISTS "Office hides confidential descriptions" ON public.transactions;
DROP POLICY IF EXISTS "Office hides journals from confidential transactions" ON public.journals;
DROP POLICY IF EXISTS "Office hides journal_lines from confidential transactions" ON public.journal_lines;

CREATE POLICY "Office hides confidential descriptions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'office'::app_role)
  OR lower(btrim(description)) NOT IN (
    'contract charles', 'contract iramaia',
    'contrato charles', 'contrato iramaia'
  )
);

CREATE POLICY "Office hides journals from confidential transactions"
ON public.journals FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'office'::app_role)
  OR NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = journals.transaction_source_id
      AND lower(btrim(t.description)) IN (
        'contract charles', 'contract iramaia',
        'contrato charles', 'contrato iramaia'
      )
  )
);

CREATE POLICY "Office hides journal_lines from confidential transactions"
ON public.journal_lines FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'office'::app_role)
  OR NOT EXISTS (
    SELECT 1
    FROM public.journals j
    JOIN public.transactions t ON t.id = j.transaction_source_id
    WHERE j.id = journal_lines.journal_id
      AND lower(btrim(t.description)) IN (
        'contract charles', 'contract iramaia',
        'contrato charles', 'contrato iramaia'
      )
  )
);