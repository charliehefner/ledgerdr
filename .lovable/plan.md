## Make "Km at registry" editable when editing a vehicle

**Problem:** The first two vehicles were registered with placeholder km values. The field is currently read-only in the edit dialog (`disabled={!!editing}` on line 321 of `VehiclesView.tsx`), so the placeholders cannot be corrected.

**Change (single file: `src/components/equipment/VehiclesView.tsx`):**

1. Remove the `disabled={!!editing}` on the `current_km` input so the field is editable in both create and edit modes.
2. Add a small helper text under the field in edit mode: *"Solo corregir si se registró con un valor incorrecto. Afecta el cálculo de mantenimiento."* (ES) / *"Only correct if registered with a wrong value. Affects maintenance calculation."* (EN).
3. Keep the existing update path — the form already sends `current_km` to the update payload at line 195, so no other logic changes are needed. Maintenance "km since last service" is derived as `current_km - last maintenance km`, which will recompute automatically.

**Out of scope:** No DB schema changes, no role gating beyond existing edit permissions, no audit log entry. If you'd like an audit trail or to restrict this to Admin/Management only, say so and I'll add it.