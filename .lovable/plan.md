I am still tracking it. I agree the prior fixes were too superficial; the issue is not simply “office needs payroll access” or “auto-open the Summary tab.”

What I verified:
- Ana’s backend role is `office` for Jord Dominicana.
- Nómina 96 exists as a closed payroll period for Jord Dominicana.
- Nómina 96 has 13 committed payroll snapshot rows.
- The database now has an `office` SELECT policy on `payroll_snapshots`, and Ana’s role/entity check returns true.
- The Day Labor receipt button is easier because it renders directly from loaded weekly entries. Payroll is different: closed payroll receipts depend on `PayrollSummary` loading snapshots, employee data, loans, benefits, and being reachable through the Summary tab.

Most likely remaining problem:
- The UI still treats Payroll Summary as a management workflow. The export/receipt controls are embedded inside the same header as preview/commit/close, and the closed-period read-only receipt workflow is not separated for `office`.
- For Ana, if closed-period snapshot data is unavailable, delayed, or the Summary tab is not reached, she gets no clear dedicated “download payroll receipts” affordance.
- The correct fix is to make closed-period payroll exports/receipts a first-class read-only action for `office`, not dependent on preview behavior or management controls.

Plan to fix it:

1. Separate payroll permissions in `PayrollSummary.tsx`
   - Add explicit flags:
     - `canPreviewPayroll`: admin, management, accountant, office for open-period previews only.
     - `canExportPayroll`: admin, management, accountant, office for read-only exports/receipts.
     - `canManagePayroll`: admin, management, accountant only for commit/close.
   - Ensure export and receipts buttons render only from `canExportPayroll`, not accidentally tied to management/preview state.

2. Make closed-period export/receipts independent of preview
   - For `periodStatus === 'closed'`, load payroll rows directly from `payroll_snapshots`.
   - Show the export dropdown and `Recibos PDF` button whenever:
     - the role can export, and
     - the period is closed, and
     - snapshots exist.
   - Do not require Ana to click `Vista Previa` for closed periods.

3. Add a clear closed-period fallback state
   - If the closed period has snapshots but supporting employee/benefit data is still loading, show a loading message instead of hiding the controls.
   - If snapshot loading errors, show the exact error banner instead of silently showing an empty area.
   - If no snapshots exist, show: “Este período está cerrado pero no tiene datos de nómina guardados.”

4. Keep office restricted from payroll management
   - Ana will not see or be able to use:
     - `Confirmar y Guardar`
     - `Cerrar Período`
     - admin rerun controls
   - She will only be able to view/export/download receipts for payroll periods she can access by entity.

5. Improve HR tab navigation for office users
   - Keep Day Labor as Ana’s default if desired, but make Payroll accessible and reliable.
   - When a closed payroll period is selected, force the internal payroll tab to `Resumen y Cierre` immediately and reset correctly when switching periods.

6. Verify against Nómina 96 specifically
   - Confirm the date range resolves to Nómina 96: 16 Apr 2026–30 Apr 2026.
   - Confirm the closed period loads 13 snapshot rows.
   - Confirm the visible buttons for Ana are:
     - `Exportar`
     - `Recibos PDF`
   - Confirm hidden buttons for Ana are:
     - `Confirmar y Guardar`
     - `Cerrar Período`

Technical changes expected:
- `src/components/hr/PayrollSummary.tsx`
  - Permission flag cleanup.
  - Closed-period snapshot loading/error handling.
  - Dedicated export/receipt rendering path for read-only roles.
- `src/components/hr/PayrollView.tsx`
  - Strengthen the closed-period Summary tab auto-selection so it cannot leave office users on the timesheet tab for closed periods.
- Potentially no database migration is needed, because the database policies and Ana’s entity role now appear correct. I will only add a migration if implementation reveals a missing RLS policy during validation.