## Problem

When office or management users upload a new document and then replace it in HR → Employee Directory, the operation actually **succeeds** (file uploaded, DB record updated), but they still see "Error al reemplazar documento". The same false error appears when they try to delete a document.

## Root Cause

The storage policies for `employee-documents` bucket are:

| Operation | Allowed roles |
|-----------|---------------|
| INSERT (upload)   | admin, management, office |
| UPDATE (replace)  | admin, management, office |
| SELECT (view)     | admin, management, accountant, supervisor, office |
| **DELETE**        | **admin only** |

In `EmployeeDetailDialog.tsx`:

- `handleReplaceDocument` does: upload new file → update DB row → **`storage.remove(oldPath)`**. For office/management users that final `remove()` is rejected by RLS, the catch block fires, and the user sees an error toast even though the replacement is complete.
- `handleDeleteDocument` does: `storage.remove(path)` → DB delete. For non-admin users, `remove()` silently returns an empty array (it does not throw — but currently it works for admins; for office/management the DB delete itself is also blocked because there is no DELETE row policy on `employee_documents` for them either — needs verification, but the immediate visible bug is the replace error).

## Fix

Two-part fix:

### 1. Database migration — allow office & management to delete storage objects

Add an UPDATE to the storage DELETE policy so office and management can remove files (needed both for clean replacement and for genuine deletion when authorized):

```sql
DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

CREATE POLICY "Authorized users can delete employee documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'office')
  )
);
```

Also verify the `employee_documents` table has a matching DELETE RLS policy for the same roles; add one if missing.

### 2. Make the old-file cleanup non-fatal in `handleReplaceDocument`

Even with the policy fix, treat the old-file cleanup as best-effort so a future RLS quirk never causes a false error after a successful replace:

```ts
// 3. Best-effort delete of the old object — never let it fail the replace
try {
  await supabase.storage.from("employee-documents").remove([storagePath]);
} catch (cleanupErr) {
  console.warn("Old file cleanup skipped:", cleanupErr);
}

toast.success("Documento reemplazado exitosamente");
```

(The Supabase client's `.remove()` returns `{ error }` rather than throwing for RLS denials, so additionally check `if (error) console.warn(...)` instead of throwing — and ensure no `throw` is reached after the DB update has already succeeded.)

## Files affected

- New migration under `supabase/migrations/` to replace the storage DELETE policy.
- `src/components/hr/EmployeeDetailDialog.tsx` — make cleanup in `handleReplaceDocument` non-fatal; mirror in `handleDeleteDocument` so the DB row is removed even if storage removal is delayed/denied.

## Result

Office and management users can replace and delete employee documents without seeing spurious errors, and orphaned files are still cleaned up when permissions allow.
