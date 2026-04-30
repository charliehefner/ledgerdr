Two unrelated issues surfaced under Ana Estrella's account.

## Issue 1 — Prestaciones won't calculate (data, not code)

Her employee record has:
- `date_of_hire` = **01 MAY 2026** (correct — she starts tomorrow)
- `date_of_termination` = **30 APR 2026** (wrong — she has not been terminated)
- `is_active` = **false** (wrong — she's onboarding)

`calculate_prestaciones` correctly throws "Termination date cannot be before hire date", which surfaces as "could not calculate". Even setting that aside, she should never have a termination date in the first place — she's a new hire.

**Fix:** Clear her termination data and reactivate her record.

```sql
UPDATE public.employees
SET date_of_termination = NULL,
    is_active = true
WHERE id = 'ba5fb29d-874d-447c-ae9e-2d76673c649c';
```

After this, prestaciones for her simply shouldn't be calculated at all (she's active with no termination), which matches reality.

## Issue 2 — Letter download fails for `office` role

Root cause: storage RLS on the `employee-documents` bucket only allows `admin / management / accountant / supervisor` to SELECT. The `office` role (which Ana has) is missing, so when her UI tries to fetch the signed URL or read the PDF, storage returns no rows and the download errors out.

The `employee_documents` **table** policies already include `office` (so she sees the row in the list), but the **storage bucket** policies were never updated when `office` was added as a 7th role. Same gap likely affects INSERT (uploading new letters).

**Fix:** Update the two storage policies to include `office`:

```sql
DROP POLICY "Authorized roles can view employee documents" ON storage.objects;
CREATE POLICY "Authorized roles can view employee documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'management')
    OR has_role(auth.uid(), 'accountant')
    OR has_role(auth.uid(), 'supervisor')
    OR has_role(auth.uid(), 'office')
  )
);

-- And mirror on the INSERT policy ("Authorized users can upload employee documents")
-- so office users can also generate new letters.
```

I'll also audit the other HR-adjacent buckets (e.g. `payroll-receipts`, `day-labor-receipts` if present) for the same `office` gap and patch any I find — but only those; no other policy changes.

## Why this happened

When the `office` role was added as a 7th role, the app-layer permissions in `src/lib/permissions.ts` and the table-level RLS for `employee_documents` were updated, but the storage bucket policies were missed. Classic split-brain between table RLS and storage RLS.

## Out of scope

- No changes to `calculate_prestaciones` permission list — `office` users shouldn't be calculating severance for others (that stays admin/management/accountant), and Ana's own record won't need it now that she's active with no termination date.
- No schema changes.

## Files / migrations

- 1 data update (Ana's employee row) — via insert tool
- 1 migration for storage RLS (drop + recreate the SELECT and INSERT policies on `storage.objects` for `employee-documents`, plus any sibling HR buckets found to have the same gap)
