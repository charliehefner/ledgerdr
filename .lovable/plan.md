I checked the published site and the current deployed JavaScript does include the Cédula attachment feature. The database responses also include `cedula_attachment_url`, and one provider already has an uploaded attachment saved. So the feature exists in the live build, but the installed Chrome app can still be stuck behind its old installed-PWA/service-worker state.

Plan to fix this more robustly:

1. Strengthen the old service-worker removal path
   - Keep `/sw.js` and `/service-worker.js` as cleanup workers.
   - Adjust the cleanup worker so it unregisters only after it has claimed clients, deleted caches, and forced controlled windows to reload to the current network version.
   - Avoid relying only on the React app booting, because old service workers can prevent the new React bundle from being reached in the first place.

2. Add compatibility for the original installed manifest path
   - Add `public/manifest.json` as an alias/copy of `manifest.webmanifest`, because old installed Chrome apps may still be pinned to `/manifest.json` from the previous PWA setup.
   - Add `<link rel="manifest" href="/manifest.json">` back to `index.html` so installability remains explicit and Chrome has a stable manifest path.

3. Make the Cédula upload discoverable outside the edit dialog
   - Add an upload button directly in the “Cédula (foto)” column for rows that do not yet have an attachment.
   - Keep the existing view icon for rows that already have an attachment.
   - Support the same quick-upload pattern in both `JornalerosView` and `ServiceProvidersView`, so users do not have to know to click the pencil/edit dialog just to upload a Cédula.

4. Improve upload reliability feedback
   - When upload succeeds, immediately update/invalidate the row and show a clear success toast.
   - If storage upload succeeds but the table update fails, show the actual failure message instead of silently leaving the row without the icon.
   - Disable the row upload button while a file is uploading to prevent double-submits.

5. Verify after implementation
   - Confirm the published assets contain the cleanup files, manifest alias, and upload strings.
   - In preview, confirm the HR tabs show the direct Cédula upload action and the existing attachment icon.

After this is approved and implemented, you’ll need to publish/update once more. The key difference from the previous attempt is that this will address old installed app manifest compatibility and add a visible row-level upload control, not just the edit-dialog upload.