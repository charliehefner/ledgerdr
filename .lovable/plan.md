## Problem

The "office" user can't see the Ford vehicle because the new `vehicles` and `vehicle_maintenance` tables only have RLS policies for: admin, management, accountant, supervisor, viewer, driver. The `office` role (which exists in the `app_role` enum and is used across other tables like `fuel_equipment`) was not included when these tables were created.

Admin/Mgmt see it fine because they have policies. Office gets zero rows back from the query.

## Fix

Add an `office` policy to both new tables, matching the pattern used on `fuel_equipment` (full access scoped by entity).

```sql
CREATE POLICY "Office full access" ON public.vehicles
  FOR ALL TO authenticated
  USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));

CREATE POLICY "Office full access" ON public.vehicle_maintenance
  FOR ALL TO authenticated
  USING (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id))
  WITH CHECK (has_role_for_entity(auth.uid(), 'office'::app_role, entity_id));
```

No code changes. After migration, the office user should see the Ford on a refresh.

## Verification

- `SELECT polname FROM pg_policy WHERE polrelid='public.vehicles'::regclass` shows 7 policies including Office.
- Office user reloads `/equipment` → Vehicles tab → Ford appears.
