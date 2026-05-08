## Goal

Restore the office user's ability to enter the Payroll **Timesheet** (Hoja de Tiempo) and confirm full Schedule (Cronograma) access.

## Findings

- **Payroll**: She *can* see Payroll — the screenshot shows Nómina 97 with the Resumen de Nómina table loading correctly. What's blocked is the **Hoja de Tiempo** tab. `src/components/hr/PayrollView.tsx` hard-locks `office` to the Summary tab:
  - Line 58: `useState(user?.role === "office" ? "summary" : "timesheet")`
  - Lines 114–118: a `useEffect` that snaps the tab back to `"summary"` whenever office tries to switch.
- **Schedule**: `office` is already in `canViewMatrix.cronograma` and `canModifyMatrix.cronograma` in `src/lib/permissions.ts`, and the RLS policies on `cronograma_entries` / `cronograma_weeks` include `entity_office_*` ALL policies. `Cronograma.tsx` and `CronogramaGrid.tsx` have no role-based gating. So she already has full access — no code change needed; just verify in-app.

## Changes

### 1. `src/components/hr/PayrollView.tsx`
- Remove the office-only override on initial tab state (line 58) → default everyone to `"timesheet"`.
- Remove the office branch in the auto-switch `useEffect` (lines 114–118) so office is no longer forced back to Summary. Keep the existing rule that auto-opens Summary when a period is `closed` (applies to all roles).

### 2. Verify Schedule (no code change)
- Log in as the office user, navigate to `/cronograma`, confirm she can view and edit cells.
- If she still reports issues there, capture the exact symptom (missing menu item, read-only cells, missing data) before making further changes.

## Out of scope
- No RLS migrations. Office RLS for payroll/cronograma tables is already correct.
- No changes to other roles' default tab behavior.