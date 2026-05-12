## Goal

Allow uploading and viewing two documents per vehicle:
- **Matrícula** (registration)
- **Proof of insurance**

Files are visible from the existing Eye (detail) panel and can be uploaded both at vehicle creation and later through the detail panel. Replacing a file overwrites the previous version.

## Storage

New private bucket `vehicle-documents` with path convention:
```
{entity_id}/{vehicle_id}/matricula.{ext}
{entity_id}/{vehicle_id}/insurance.{ext}
```

RLS on `storage.objects` for this bucket: any authenticated user with a role on the entity (admin / management / accountant / supervisor / office / viewer for read; admin / management / accountant / supervisor / office for write+delete) — same pattern used elsewhere. Files served via signed URLs (1h) like `cedula-attachments`.

No new columns on `vehicles` — file presence is derived by listing the prefix `{entity_id}/{vehicle_id}/`. (Matches how cedula attachments work today, keeps the schema clean and avoids stale paths.)

## UI changes (`VehiclesView.tsx` + `VehicleDetailPanel`)

1. **Detail panel (Eye icon)** — add a "Documentos" section with two rows: Matrícula, Seguro. Each row shows:
   - If file exists → filename + "Ver" (opens signed URL in new tab) + "Reemplazar" + "Eliminar".
   - If missing → "Subir" button.
   - Insurance row also shows the existing `insurance_expiration` countdown badge inline.
2. **Create dialog** — add two optional file inputs (Matrícula, Seguro). After the vehicle insert succeeds, upload any selected files to the new bucket using the returned `vehicle.id`.
3. **Vehicles list table** — add a small paperclip indicator column showing 0/1/2 documents attached (tooltip lists which).

Accepted file types: `image/*, application/pdf`. Max 10 MB (toast on overflow).

## Files

- **New migration**: create bucket + storage policies.
- **Edit** `src/components/equipment/VehiclesView.tsx`: add upload inputs to create dialog, document indicator column, document section in detail panel, upload/list/delete helpers.
- **Edit** `src/i18n/es.ts` and `src/i18n/en.ts`: keys `equipment.vehicles.docs.*` (matricula, insurance, upload, replace, delete, view, none).

## Out of scope

- No changes to fueling, maintenance, alerts, or accounting.
- No bulk upload, versioning, or history of replaced documents.

## Verification

- Office user uploads matrícula PDF → reload → file listed, "Ver" opens signed URL.
- Replace insurance image → old object overwritten, new one served.
- Delete matrícula → row goes back to "Subir".
- Create new vehicle with both files attached → after save, detail panel shows both.
