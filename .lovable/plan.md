## Vehicles in Equipment + 5611 vehicle/km capture

### 1. Database (new table `vehicles`)

Columns:
- `id uuid pk`, `entity_id uuid not null default current_user_entity_id()`
- `vehicle_type text check in ('motorcycle','pickup','car')`
- `name text not null`, `brand text`, `model text`
- `vin text`, `license_plate text`
- `maintenance_interval_km integer not null default 5000`
- `insurance_expiration date`
- `purchase_date date`, `purchase_cost numeric`
- `current_km numeric not null default 0` (updated on each refueling)
- `is_active boolean default true`, `created_at`, `updated_at`

New table `vehicle_maintenance` (mirrors `tractor_maintenance`):
- `id`, `vehicle_id fk`, `maintenance_date`, `km_reading numeric`, `maintenance_type text`, `notes text`, `entity_id`, `created_at`.

RLS: same 6-role pattern as `fuel_equipment` / `tractor_maintenance` (admin/mgmt/accountant/supervisor full; viewer select; driver select).

Link refueling → vehicle: add `vehicle_id uuid` and `vehicle_km numeric` to `transactions` (nullable). Used only when `master_acct_code = '5611'`. No effect on journals.

### 2. Equipment page — new "Vehicles" tab

Add tab in `src/pages/Equipment.tsx` between "Implements" and "Hour meter". New component `src/components/equipment/VehiclesView.tsx` modeled on `TractorsView`:

- Header button **"+ Vehicle"** → dialog with all registry inputs (type select, name, brand, model, VIN, license plate, maintenance_interval_km, insurance_expiration date picker, purchase_cost, purchase_date, current_km).
- Table columns (default visible): **Name**, **Brand**, **Km to maintenance** (= `interval - (current_km - last_maintenance_km) mod interval`, color-coded badge: green/yellow/red same thresholds as tractors).
- Row actions: **Eye icon** → read-only detail panel (Dialog) showing every registry field + insurance expiration countdown + maintenance history list. **Pencil icon** → edit. **Wrench icon** → `VehicleMaintenanceDialog` (clone of `TractorMaintenanceDialog`, km instead of hours).

i18n keys under `equipment.vehicles.*` (es + en).

### 3. Alerts integration

Extend `useAlertData.ts` with `useVehicleAlerts(configs)`:
- Maintenance due: when km-since-last-maintenance ≥ interval (red) or ≥ 90 % (yellow).
- Insurance expiring: red if past, yellow if within 30 days.

Add to the Equipment alert sector in `Alerts.tsx` alongside tractor alerts. Add two new `alert_configurations` rows (`vehicle_maintenance_km`, `vehicle_insurance_expiry`).

### 4. Transactions form — vehicle + km when 5611

In `src/components/transactions/TransactionForm.tsx`, when `master_acct_code === '5611'`:
- Render two extra inline fields (after amount): **Vehicle** (Select of active vehicles for current entity) and **Km al tanqueo** (number input).
- On submit, persist `vehicle_id` and `vehicle_km` on the transaction row.
- After successful insert, if both present and `vehicle_km > vehicle.current_km`, update `vehicles.current_km = vehicle_km` (single client-side update, scoped by entity). No effect when 5611 not selected.

Existing fuel-from-tank flow (driver wizard / `fuel_transactions`) is **unchanged** in this iteration — vehicle km capture happens only in the manual Transactions form (the "from purchase" path the user described). If needed later, the driver wizard can be extended.

### 5. Out of scope

- No accounting/journal changes.
- No changes to tractors, generators, or fuel tanks.
- No driver-portal vehicle refueling UI.

### Verification

- Create a pickup with interval 5,000 km, current 12,000.
- Register a 5611 transaction selecting that vehicle, km = 13,200 → vehicle row shows current_km 13,200, "Km to maintenance" decreases.
- Cross past the interval → alert appears under Equipment in `/alerts`.
- Set insurance_expiration to today+10 → yellow alert; -1 → red alert.
- Eye panel shows all fields including VIN and plate.