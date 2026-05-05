## Goal
Allow users to upload a scan/photo of the cédula (front, optionally back) for each Jornalero and Service Provider (Prestador), with a way to view it from the registry table.

## Database changes (migration)
- Add `cedula_attachment_url TEXT NULL` to `public.jornaleros`.
- Add `cedula_attachment_url TEXT NULL` to `public.service_providers`.
- Create a new private storage bucket `cedula-attachments` (private, like `transaction-attachments`).
- RLS policies on `storage.objects` for that bucket: allow authenticated users to `SELECT`, `INSERT`, `UPDATE`, `DELETE` files (scoped to bucket). Path convention: `jornaleros/{jornaleroId}.{ext}` and `providers/{providerId}.{ext}`.
- Reuse the existing `get-signed-url` edge function but extend it (or add a small generalized branch) to also accept files from the `cedula-attachments` bucket. Simplest: update `get-signed-url` to take an optional `bucket` parameter (default to `transaction-attachments` for backward compatibility).

## Frontend changes

### `src/components/hr/JornalerosView.tsx`
- Extend `Jornalero` interface with `cedula_attachment_url: string | null`.
- In the Add/Edit dialog, add a new field "Cédula (foto)":
  - File input (`accept="image/*,application/pdf"`).
  - On select, upload immediately to `cedula-attachments` at path `jornaleros/{id-or-temp}.{ext}` using `supabase.storage`.
  - Store the resulting path on save into `cedula_attachment_url`.
  - If editing and file already exists, show a small preview/link "Ver cédula" + replace button.
- In the table, add a new column "Cédula" (icon button) that opens a signed URL in a new tab when an attachment exists; show `—` otherwise.

### `src/components/hr/ServiceProvidersView.tsx`
- Same pattern: extend `ServiceProvider` interface, add upload field in dialog, add view column in the registry table (path: `providers/{id}.{ext}`).

### Shared helper
- Add `src/lib/cedulaAttachments.ts` with two helpers:
  - `uploadCedula(file, kind: 'jornalero'|'provider', id: string)` → returns the storage path.
  - `getCedulaSignedUrl(path)` → calls the `get-signed-url` edge function with the `cedula-attachments` bucket.

## i18n
- Add keys to `src/i18n/es.ts` and `src/i18n/en.ts`: `common.cedulaAttachment` ("Cédula (foto)" / "ID document"), `common.viewCedula`, `common.replaceCedula`, `common.uploadCedula`.

## UX details
- Accept JPG, PNG, PDF up to ~10 MB.
- Show a toast on success/failure.
- Files are upserted (overwrite on replace) so each jornalero/provider has at most one stored file.
- The "Ver" button uses a fresh signed URL each time it is clicked.

## Out of scope
- No OCR / auto-fill of cédula number from the image (already exists separately as `ScanCedulaButton`).
- No back-of-cédula second slot (single image per worker).