I found the actual failure in the latest network request. This is not the same RLS/role problem as the earlier fixes.

Do I know what the issue is? Yes.

Exact problem: the upload path is built from the raw uploaded filename:

```ts
`${employeeId}/${Date.now()}_${file.name}`
```

The file that failed was:

```text
Cálculo prestaciones Jose Luis Cespedes Rosón corrigido.pdf
```

Because the storage object key includes accented/non-ASCII characters (`á`, `ó`, and likely composed accent characters), Lovable Cloud Storage rejects it with:

```text
400 InvalidKey: Invalid key
```

So Ana/office permissions are not the blocker for this specific “Subir Documento” error. The file path itself is invalid. The app should preserve the nice original filename in `document_name`, but use a safe ASCII-only filename for `storage_path`.

Files involved:
- `src/components/hr/EmployeeDetailDialog.tsx` — manual upload and replace document paths
- `supabase/functions/generate-hr-letter/index.ts` — generated letters already use safe storage paths, no change expected there
- `supabase/functions/get-signed-url/index.ts` — path validation already accepts UUID-folder paths, no change expected unless we decide to tighten validation

Plan:

1. Add a small filename sanitizer in `EmployeeDetailDialog.tsx` or a shared utility:
   - Normalize Unicode.
   - Remove accents/diacritics.
   - Replace invalid characters with `-` or `_`.
   - Keep the file extension.
   - Ensure there is always a fallback like `documento.pdf`.

2. Update `handleDocumentUpload`:
   - Store files under a safe path like:
     ```text
     {employeeId}/{timestamp}_{sanitized-filename}
     ```
   - Keep `document_name: file.name` so the UI still displays the original Spanish filename with accents.
   - Pass `contentType: file.type` during upload.

3. Update `handleReplaceDocument` for consistency:
   - Continue using a fresh path, but sanitize the extension/name portion defensively.
   - Keep `document_name: file.name` unchanged for display.

4. Improve the upload error toast:
   - If the backend returns `InvalidKey`, show a clearer Spanish message such as:
     ```text
     El nombre del archivo contiene caracteres no permitidos. Se intentará guardar con un nombre seguro.
     ```
   - After the sanitizer is applied, this should not occur for accented filenames.

5. Keep the existing role/RLS policies as-is for now:
   - This specific error is a `400 InvalidKey`, not an authorization denial.
   - No database migration is needed for this filename fix.

Expected result:
- Uploading `Cálculo prestaciones Jose Luis Cespedes Rosón corrigido.pdf` will succeed.
- The stored path will be safe, e.g. `calculo-prestaciones-jose-luis-cespedes-roson-corrigido.pdf`.
- The document list will still display the original filename with accents.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>