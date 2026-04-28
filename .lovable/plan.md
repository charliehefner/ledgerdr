## Goal

Refine the `office` role so it matches the requested scope:

| Area | Current | Target |
|---|---|---|
| HR → Nómina (Hoja de Tiempo) | No access | **Read/write** access (timesheet tab only — not the closing/summary actions if they require accounting) |
| HR → Empleados → Documentos / Cartas / Vacaciones | Tab visible, but upload/letter/vacation buttons gated by `canModifySettings` (admin only) | Office can upload docs, generate letters, add vacation periods |
| Financiero (Ledger) — `/reports` | Accessible | Keep as-is (already works) |
| Contabilidad (`/accounting`) | Accessible (read-only) | **Removed** |
| Cuentas por Cobrar/Pagar (`/ap-ar`) | Not accessible | Keep as-is |
| Tesorería | Sees all 4 tabs (Conciliación, Cuentas, Tarjetas, Caja Chica) — defaults to Caja Chica | **Only Caja Chica tab visible** |

## Changes

### 1. `src/lib/permissions.ts`
- `hrTabPermissions.payroll`: add `"office"`.
- `hrTabWritePermissions.payroll`: add `"office"`.
- `sectionPermissions.accounting`: remove `"office"`.
- Update the `office` description comment to reflect new scope (Payroll timesheet, no accounting access).

### 2. `src/components/hr/EmployeeDetailDialog.tsx`
Replace the `canModifySettings` gates that block office from HR-writer features in the Documents and Vacations tabs with `isHrWriter` (which is `canWriteSection("hr")` and is already true for office). Specifically swap `canModifySettings` → `isHrWriter` on:
- Vacations tab: "Agregar Período de Vacaciones" card (line 983) and the delete-vacation column/button (lines 1046, 1064).
- Documents tab: "Subir Documento" card with file input + "Generar Carta" button (line 1215), and the row replace/delete actions (line 1293).

Leave the Incidents tab gates and other admin-only HR controls untouched (not in scope).

### 3. `src/components/hr/VacationCountdownDialog.tsx`
Swap the two `canModifySettings` gates (TabsTrigger "add" at line 199, delete column at lines 340/358) for `canWriteSection("hr")` so office can also add/delete vacation periods from the countdown dialog (consistent with EmployeeDetailDialog).

### 4. `src/components/accounting/TreasuryView.tsx`
For `office` role, render only the Caja Chica tab — hide the Conciliación, Cuentas Bancarias, and Tarjetas de Crédito triggers and tab contents. Other roles continue seeing all four tabs.

### 5. HR Payroll write capability for office
`PayrollTimeGrid` and `PayrollView` already perform writes without role gates. Granting `payroll` HR-tab access (step 1) is sufficient for office to use Hoja de Tiempo. The "Resumen y Cierre" (close period / generate accruals) tab will also become visible — confirm below whether to restrict it.

## Open question (will ask before implementing)

The `payroll` tab contains two sub-tabs: **Hoja de Tiempo** and **Resumen y Cierre** (period close, accrual generation, posting to accounting). Office needs Hoja de Tiempo. Should office ALSO see/use Resumen y Cierre, or should that sub-tab be hidden for office (since closing payroll generates accounting journals)?

## Out of scope

- No DB / RLS changes — all current RPCs (vacation insert, document upload, letter generation, payroll time entries) already accept any authenticated user with the appropriate `entity_id` context. The role checks being relaxed are UI-only; server-side RLS policies on the underlying tables (`employee_vacations`, `employee_documents`, `payroll_time_entries`, etc.) already permit writes for users with active roles in the entity. If we discover a server-side block during testing we'll address it then.
- No changes to `viewer`, `supervisor`, `accountant`, `management`, `admin`, or `driver` permissions.
