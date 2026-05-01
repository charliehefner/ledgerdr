## Problem

Ana ('office') opens **Payroll → Resumen y Cierre** but doesn't see the Export / Receipts buttons usable. Code review shows:

- The buttons themselves render, but they are `disabled` whenever `payrollData.length === 0`.
- For an **open** period, `payrollData` is populated only after clicking the **"Vista Previa"** button, which is gated by `canManagePayroll` (admin / management / accountant only).
- Office is excluded from `canManagePayroll`, so she can never trigger preview → buttons stay disabled → effectively "no export button".
- Closed periods auto-load snapshots, so those should already work after today's earlier RLS fix; the broken case is the open / current period.

## Fix

Single small change in `src/components/hr/PayrollSummary.tsx`:

1. Add a new flag `canPreviewPayroll = canManagePayroll || user?.role === "office"`.
2. Use `canPreviewPayroll` (instead of `canManagePayroll`) to gate the **Preview** button and the **Re-run preview** button visibility for office.
3. Keep `canManagePayroll` for the destructive actions: **Confirm and Save** (commit) and **Close Period** — office stays excluded from those.
4. Export dropdown and Receipts button stay as-is (already unconditional in the UI; their disabled state will resolve once Ana can run preview).

No DB / RLS changes needed — RLS already grants office read access to all required tables (verified earlier).

## Result

- Office sees **Vista Previa Nómina** on open periods → clicks it → grid populates → **Exportar** dropdown and **Recibos PDF** become enabled.
- Office still cannot **commit** or **close** the period.
- Closed-period receipts continue to work via auto-loaded snapshots.

## Out of scope

- No other role gates change.
- No new RLS policies.
