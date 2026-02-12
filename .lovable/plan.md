

## Internal Message Board -- Smart Alerts Dashboard

### What it does
A single-page alerts dashboard accessible only to Admin and Gerencia roles, shown as a new sidebar item ("Alertas") near the top of the navigation. The page displays all alerts on one scrollable view, grouped into five labeled sectors -- no tabs to click through.

Each sector (HR, Operaciones, Equipos, Combustible, Inventario) shows its alerts as color-coded cards (red = urgent, yellow = warning, blue = info). If a sector has no active alerts, it shows a green "all clear" message.

An admin-only configuration section (accessible from the page itself or from Settings) lets admins enable/disable specific alert types and adjust thresholds.

### Alert Types (Starting Set)

**HR**
- Upcoming vacations (employee vacation due within 30 days, computed from last vacation end_date + 1 year, or date_of_hire + 1 year if no vacation record)
- Overdue vacations (past the due date)

**Operaciones**
- Overdue follow-ups from Seguimientos that failed to schedule (no slot found)

**Equipos**
- Preventive maintenance due within X hours (default 20) -- computed from fuel_equipment.current_hour_meter, maintenance_interval_hours, and last tractor_maintenance.hour_meter_reading
- Overdue maintenance (hours remaining is negative)

**Combustible**
- Diesel tank below X% capacity (default 10%) -- computed from fuel_tanks.current_level_gallons / capacity_gallons

**Inventario**
- Low stock items below a configurable minimum quantity per item
- Inputs needed for upcoming Seguimientos but not available in inventory

### Page Layout

```text
+------------------------------------------+
|  Alertas Internas          [Configurar]  |
+------------------------------------------+
|                                          |
|  --- RECURSOS HUMANOS (2 alertas) ---    |
|  [!] Vacaciones vencidas - Juan Perez    |
|  [!] Vacaciones próximas - Maria Lopez   |
|                                          |
|  --- OPERACIONES (0 alertas) ---         |
|  All clear                               |
|                                          |
|  --- EQUIPOS (1 alerta) ---             |
|  [!] Mantenimiento próximo - JD 6110B    |
|                                          |
|  --- COMBUSTIBLE (1 alerta) ---          |
|  [!!] Tanque Diesel A al 8% capacidad    |
|                                          |
|  --- INVENTARIO (0 alertas) ---          |
|  All clear                               |
+------------------------------------------+
```

### Configuration

A dialog or collapsible section on the Alerts page (admin-only) allows toggling each alert type on/off and adjusting thresholds:

| Alert Type | Default Threshold | Adjustable |
|---|---|---|
| Vacation upcoming | 30 days | Yes |
| Fuel tank low | 10% | Yes |
| Maintenance due | 20 hours | Yes |
| Inventory low | Per-item minimum_stock | Yes (per item) |
| Seguimiento inputs missing | On/Off | Toggle only |
| Overdue follow-ups | On/Off | Toggle only |

### Stability

- **Zero risk to existing features**: all alert computation is read-only queries against existing tables
- **No background jobs**: alerts are computed on page load using React Query
- **Isolated**: new page, new route, no modifications to existing business logic
- **Small database footprint**: one new config table, one optional column

---

### Technical Details

**Database changes:**

1. New table `alert_configurations`:
   - id (uuid PK)
   - alert_type (text, unique) -- e.g. 'fuel_tank_low', 'maintenance_due', 'vacation_upcoming', 'inventory_low', 'followup_inputs_missing', 'overdue_followups'
   - is_active (boolean, default true)
   - threshold_value (numeric, nullable)
   - created_at, updated_at (timestamptz)
   - RLS: read for authenticated, write for admin/management

2. Add `minimum_stock` column (numeric, nullable) to `inventory_items` for per-item low-stock thresholds.

**New files:**

1. `src/pages/Alerts.tsx` -- Main page with all five sectors rendered vertically. Uses multiple useQuery hooks to fetch data from employees, employee_vacations, fuel_tanks, fuel_equipment, tractor_maintenance, inventory_items, and operation_followups. Computes alert conditions in-memory.

2. `src/components/alerts/AlertCard.tsx` -- Reusable alert card component with severity styling (red/yellow/blue border + icon).

3. `src/components/alerts/AlertSector.tsx` -- Section wrapper with header showing sector name and alert count.

4. `src/components/alerts/useAlertData.ts` -- Custom hook containing all the query and computation logic for each alert category.

5. `src/components/alerts/AlertConfigDialog.tsx` -- Admin-only dialog to manage which alerts are active and their thresholds.

**Modified files:**

1. `src/lib/permissions.ts` -- Add "alerts" to Section type, grant access to admin and management roles only.

2. `src/components/layout/Sidebar.tsx` -- Add "Alertas" nav item with Bell icon, placed after Dashboard.

3. `src/App.tsx` -- Add /alerts route wrapped in ProtectedRoute.

