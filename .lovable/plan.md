## Problem

Adding an Implement in **Equipment → Implements** fails with an `entity_id` error. `ImplementsView.tsx` builds the insert payload without `entity_id`, but the `implements` table requires it (NOT NULL). Per project memory: *"Always pass `entity_id` explicitly in Edge/RPCs to avoid context issues."*

A trace across sibling registries (Equipment / Fuel / Industrial) shows the same omission in several files. Some target tables have `entity_id NOT NULL` (hard failure), others are `NULL`-able (silent — rows become orphaned/global, breaking entity scoping).

## Trace results

| File | Table | entity_id NOT NULL? | Status |
|---|---|---|---|
| `fuel/ImplementsView.tsx` | `implements` | YES | Broken (reported) |
| `fuel/TractorsView.tsx` | `fuel_equipment` | YES | Broken |
| `fuel/FuelTanksView.tsx` | `fuel_tanks` | YES | Broken |
| `fuel/TractorMaintenanceDialog.tsx` | `tractor_maintenance` | YES | Broken |
| `equipment/FixedAssetDialog.tsx` | `fixed_assets` | NULL ok | Silent scoping bug |
| `industrial/CarretasView.tsx` | `industrial_carretas` | NULL ok | Silent scoping bug |
| `industrial/TrucksView.tsx` | `industrial_trucks` | NULL ok | Silent scoping bug |
| `industrial/PlantHoursView.tsx` | `industrial_plant_hours` | NULL ok | Silent scoping bug |

## Fix

In each file above:

1. Import `useEntity` from `@/contexts/EntityContext`.
2. Get `requireEntity` (and `selectedEntityId` where helpful).
3. At submit time, call `const entityId = requireEntity();` — if `null`, show toast "Selecciona una entidad antes de crear" and abort. This also blocks creates while the global admin is in *All Entities* mode (correct behavior — these are entity-scoped registries).
4. Spread `entity_id: entityId` into the insert payload only (not on update — preserve original entity).

No DB migrations are needed; the schema already enforces what we want.

## Out of scope

A full audit of all ~45 files using `.insert(` is not done here. If you want, after this fix I can run a follow-up sweep across `accounting/`, `operations/`, `hr/`, `inventory/`, `settings/`, `transactions/`, and `budget/` modules and report any remaining gaps before touching them.

## Files to edit

- `src/components/fuel/ImplementsView.tsx`
- `src/components/fuel/TractorsView.tsx`
- `src/components/fuel/FuelTanksView.tsx` (both inserts at lines 106 and 140)
- `src/components/fuel/TractorMaintenanceDialog.tsx`
- `src/components/equipment/FixedAssetDialog.tsx`
- `src/components/industrial/CarretasView.tsx`
- `src/components/industrial/TrucksView.tsx`
- `src/components/industrial/PlantHoursView.tsx`
