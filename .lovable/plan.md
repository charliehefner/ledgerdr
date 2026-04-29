## Sweep results

Searched all `.from('<table>').insert(...)` calls into entity-scoped tables and identified files that omit `entity_id` for tables where the column is `NOT NULL`.

### Already correct (no change needed)
`EditTransactionDialog`, `EmployeeFormDialog`, `ServicesView`, `ServiceProvidersView`, `ReplenishmentDialog`, `InventoryItemDialog`, `EntitySetupWizard`, `ApArDocumentList` — already pass `entity_id` (sometimes via conditional spread, OK because target column is nullable or guarded upstream).

### Files to fix

| File | Table | Source for entity_id |
|---|---|---|
| `src/hooks/useOfflineQueue.ts` | `fuel_transactions` | derive from tank (`fuel_tanks.entity_id`) — no UI context offline |
| `src/components/hr/VacationCountdownDialog.tsx` | `employee_vacations` | `useEntity().requireEntity()` |
| `src/components/hr/EmployeeLoansSection.tsx` | `employee_loans` | derive from employee (`employees.entity_id`) — accept optional `entityId` prop or fetch once |
| `src/components/hr/EmployeeDetailDialog.tsx` | `employee_vacations`, `employee_incidents` | `(employee as any).entity_id` (already used for `employee_documents` in same file) |
| `src/components/hr/DayLaborView.tsx` | `day_labor_entries` | `selectedEntityId` (already destructured) |
| `src/components/operations/contracts/ContractDialog.tsx` | `service_contracts` | `useEntity().requireEntity()` |
| `src/components/fuel/IndustryFuelView.tsx` | `fuel_transactions` (refill) | derive from `fuel_tanks.entity_id` for the chosen tank |
| `src/components/fuel/AgricultureFuelView.tsx` | `fuel_transactions` (dispense) | derive from `fuel_tanks.entity_id` (already fetching the tank for `fuel_type`) |
| `src/components/fuel/FuelTanksView.tsx` line 141 | `fuel_transactions` (transfer) | `selectedEntityId` (already destructured) |
| `src/components/operations/FarmsFieldsView.tsx` | `farms` | `selectedEntityId` (already destructured). `fields` has no `entity_id` column — no change. |

### Approach

- Tables whose component already has UI entity context: pass `selectedEntityId` (with a guard that throws if null).
- HR sub-records tied to an employee: prefer the employee's `entity_id` so a vacation/loan/incident always lives in the same entity as the employee, even if a global admin is viewing All Entities.
- Offline queue and fuel transactions for a chosen tank: derive `entity_id` from the tank record (one extra select), so offline submissions don't depend on UI state.

For `EmployeeLoansSection`, the parent (`EmployeeDetailDialog`) already has the employee object — we'll pass `entityId` as an optional prop so we don't need an extra fetch.

No DB migrations needed.
