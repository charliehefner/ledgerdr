

# Full System Audit: Access, Flows, and Bug Report

## Summary of Users Tested (14 users, 6 roles)

| Role | Users | Default Route | Entity |
|---|---|---|---|
| Admin (2) | charliehefner, irabassoi | / (Dashboard) | E1 |
| Accountant (4) | kiarajdl, impuestos, jorgejdl, mauriciojdl | / (Dashboard) | E1 |
| Supervisor (4) | cedenojord, joseluisjord, edwin.viscaino, ronnycocajord | /operations | E1 |
| Viewer (1) | diegojord | / (Dashboard) | E1 |
| Driver (3) | chichojord, dionijord, maikoljord | /driver-portal | E1 |

All 14 users are correctly assigned to E1 entity. No NULL entity_ids remain. Role assignments and default routes are correct per `permissions.ts`.

---

## BUGS FOUND — Actionable Fixes

### BUG 1 (CRITICAL): `ap_ar_document_transactions` table has RLS DISABLED
- This junction table linking AP/AR documents to transactions has **no RLS at all**.
- Any authenticated user (including drivers and viewers) can read, insert, update, or delete rows.
- **Fix**: Enable RLS and add entity-scoped policies matching `ap_ar_documents`.

### BUG 2 (HIGH): 9 database views use SECURITY DEFINER instead of SECURITY INVOKER
Views: `general_ledger`, `trial_balance_all`, `v_ap_ar_aging`, `v_fuel_consumption`, `v_inventory_low_stock`, `v_payroll_summary`, `v_transactions_by_cost_center`, `v_transactions_with_dop`, `v_trial_balance`

- These views execute with the **creator's privileges**, completely bypassing RLS.
- A driver could query `v_payroll_summary` and see all salary data.
- **Fix**: Recreate each view with `WITH (security_invoker = on)`.

### BUG 3 (HIGH): 257 legacy `has_role()` RLS policies still active across 69 tables
- The previous migration was supposed to clean these up but only addressed 6 tables.
- On tables that have BOTH old `has_role()` and new `has_role_for_entity()` policies, PostgreSQL ORs them — the old policies effectively **bypass entity isolation**.
- This is harmless in single-entity mode but is a ticking time bomb for multi-entity.
- **Fix**: On the ~43 tables that already have `has_role_for_entity()` policies, drop the old `has_role()` duplicates. For the remaining ~26 tables without entity_id, the old policies are correct and should stay.

### BUG 4 (MEDIUM): Industrial module (Carretas, Trucks, Plant Hours) has no entity scoping
- Tables `industrial_carretas`, `industrial_plant_hours`, `industrial_trucks` lack `entity_id` column entirely.
- Frontend components don't use `useEntityFilter`.
- Currently harmless (single entity), but will cause data leaks with multiple entities.
- **Fix**: Add `entity_id` column with default to these 3 tables; add entity-scoped RLS; add `useEntityFilter` to frontend components.

### BUG 5 (MEDIUM): Fuel, Operations, HR modules missing frontend entity filtering
- `FuelTanksView`, `TractorsView`, `FuelEquipmentView`, `OperationsLogView`, `FarmsFieldsView`, `DayLaborView`, `EmployeeList`, `PayrollView` — none use `useEntityFilter`.
- RLS handles access at the DB level, but if a global admin is in "All Entities" mode, switching entities won't filter the UI.
- **Fix**: Add `useEntityFilter` to these components' query hooks.

### BUG 6 (LOW): `requireEntity()` guard missing from most write mutations
- Only Cronograma and FxRevaluation use `requireEntity()` before writes.
- Other modules (Transactions, Inventory, Operations, HR) rely solely on the DB default `current_user_entity_id()` — which works, but a global admin in "All Entities" mode could accidentally create records tagged to the wrong entity.
- **Fix**: Add `requireEntity()` guard to mutation handlers in TransactionForm, InventoryItemDialog, OperationsLogView, etc.

### BUG 7 (LOW): `tractor_operators`, `transportation_units` have fully open RLS (USING true / WITH CHECK true)
- Any authenticated user can CRUD these configuration tables.
- **Fix**: Restrict write access to admin/management roles.

---

## Implementation Plan (Prioritized)

### Step 1 — Critical DB fixes (migration)
1. Enable RLS on `ap_ar_document_transactions` with proper policies
2. Recreate 9 views with `security_invoker = on`
3. Drop duplicate `has_role()` policies on tables that already have `has_role_for_entity()`

### Step 2 — Industrial module entity scoping (migration + frontend)
1. Add `entity_id` column to `industrial_carretas`, `industrial_plant_hours`, `industrial_trucks`
2. Add entity-scoped RLS policies
3. Add `useEntityFilter` to `CarretasView`, `TrucksView`, `PlantHoursView`

### Step 3 — Frontend entity filtering
Add `useEntityFilter` to:
- `FuelTanksView`, `TractorsView`, `FuelEquipmentView`
- `OperationsLogView`, `FarmsFieldsView`
- `DayLaborView`, `EmployeeList`
- `RainfallView`, `HerbicideCalculation`

### Step 4 — Write guards
Add `requireEntity()` to mutation handlers in:
- `TransactionForm`, `InventoryItemDialog`, `OperationsLogView`
- `DayLaborView`, `EmployeeFormDialog`

### Step 5 — Tighten open RLS
Restrict `tractor_operators` and `transportation_units` write access to admin/management/supervisor roles.

---

## What's Working Correctly
- All user role assignments and entity scoping in `user_roles` ✓
- Login/redirect flow per role (supervisor→operations, driver→driver-portal) ✓
- Cronograma entity scoping and save flow (fixed last session) ✓
- Bank Accounts, Credit Cards, Petty Cash, Fixed Assets, Contacts entity filtering ✓
- DB defaults (`current_user_entity_id()`) on 40+ tables ✓
- `get_user_role` RPC with retry logic ✓
- MFA flow (currently disabled but wired) ✓
- Protected routes with role-based access control ✓

