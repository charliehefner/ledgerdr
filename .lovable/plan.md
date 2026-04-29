## Goal

Hide transactions whose description is exactly **"Contract Charles"** or **"Contract Iramaia"** from the **office** role only. Everywhere else (admin, management, accountant, supervisor, viewer, driver) sees them unchanged.

The hide must hold in both the Transactions list and the Financial / Ledger views (journals + journal lines + drilldowns), and it must be enforced in the database so it can't be bypassed via the API.

## Approach

Pure RLS, no schema change, no UI change. We add SELECT policies that exclude the two exact descriptions when the viewer is an office user, and exclude their derived journals / journal lines as well.

Match is **case-insensitive, trimmed, exact** — `lower(trim(description)) IN ('contract charles', 'contract iramaia')`. So:

- Hidden: `Contract Charles`, `contract charles`, `Contract Iramaia` (exact wording, any case, surrounding spaces ignored)
- NOT hidden: `Contrato Charles`, `Pago a Charles Hefner`, `Migración residencia Charles`, `Almuerzo … reembolso Charles`, `Contrato Iramaia`, etc.

If you later want any of those Spanish variants hidden too, we just add them to the list — one-line change.

## Step 1 — RLS on `transactions`

Replace the office-applicable SELECT policy so office cannot see the two descriptions. Keep all other roles' policies untouched.

```sql
-- Drop the existing office SELECT (will be re-checked & named in the migration)
-- then add:
CREATE POLICY "Office hides confidential descriptions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'office'::app_role)
  OR lower(trim(description)) NOT IN ('contract charles', 'contract iramaia')
);
```

## Step 2 — RLS on `journals`

```sql
CREATE POLICY "Office hides journals from confidential transactions"
ON public.journals FOR SELECT
TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'office'::app_role)
  OR NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = journals.transaction_source_id
      AND lower(trim(t.description)) IN ('contract charles', 'contract iramaia')
  )
);
```

## Step 3 — RLS on `journal_lines`

```sql
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
      AND lower(trim(t.description)) IN ('contract charles', 'contract iramaia')
  )
);
```

Before writing the migration I'll inspect the existing policies on these three tables and replace only the office-relevant ones — other roles' access stays exactly as today.

## Side effects (intended)

For the office user, these transactions silently disappear from:

- Transactions page + Recent Transactions
- Approvals queue (if relevant)
- Ledger account drilldowns
- P&L / Cash Flow / Treasury totals (totals will be slightly lower than what admin sees — this is the intended behavior)
- AI Search context
- DGII 606/607/608 reports rendered for office
- Backups exported by the office user

Performance impact: negligible. The two `EXISTS` lookups are indexed lookups by `id`.

## Verification

After deploy, log in as the office user and confirm:

1. Search for "Contract Charles" / "Contract Iramaia" in Transactions returns nothing.
2. Direct URL to one of the row IDs returns "not found".
3. Ledger drilldown for the contra account does not list the entries.
4. Other transactions mentioning Charles or Iramaia (e.g. `Pago a Charles Hefner`, `Contrato Iramaia` in Spanish) ARE still visible — confirms the match is exact, not fuzzy.

## Rollback

Single migration drops the three policies and restores the prior ones — clean reversal.
