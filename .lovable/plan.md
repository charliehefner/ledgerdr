

## Plan: Add Industrial Page

### Overview
Create a new "Industrial" page at `/industrial` with three sub-tabs: Horas Planta, Carretas, and Trucks. Accessible to admin and supervisor roles only.

### Database (3 new tables via migration)

**1. `industrial_plant_hours`**
- `id` (uuid, PK, default gen_random_uuid())
- `date` (date)
- `start_hour_meter` (numeric)
- `finish_hour_meter` (numeric)
- `notes` (text)
- `created_at`, `updated_at` (timestamptz)
- `created_by` (uuid, references auth.users)

**2. `industrial_carretas`**
- `id` (uuid, PK)
- `datetime_out` (timestamptz) — fecha/hora saliendo
- `datetime_in` (timestamptz) — fecha/hora entrando
- `tare` (numeric)
- `payload` (numeric)
- `weigh_ticket_number` (text)
- `notes` (text)
- `created_at`, `updated_at`, `created_by`

**3. `industrial_trucks`**
- `id` (uuid, PK)
- `datetime_in` (timestamptz) — fecha/hora entrando (trucks originate outside)
- `datetime_out` (timestamptz) — fecha/hora saliendo
- `tare` (numeric)
- `payload` (numeric)
- `weigh_ticket_number` (text)
- `destination_payload` (text)
- `notes` (text)
- `created_at`, `updated_at`, `created_by`

All fields nullable (no required inputs). RLS policies for admin + supervisor read/write. Enable realtime not needed initially.

### Permissions (`src/lib/permissions.ts`)
- Add `"industrial"` to `Section` type
- Add to `sectionPermissions`: `["admin", "supervisor"]` (management intentionally excluded per request — admin + supervisor only)
- Add to `writePermissions`: `["admin", "supervisor"]`
- Add to `routeToSection`: `"/industrial": "industrial"`

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Add nav item: `{ nameKey: "nav.industrial", href: "/industrial", icon: Factory, section: "industrial" }`
- Import `Factory` from lucide-react

### Router (`src/App.tsx`)
- Add route: `/industrial` → `<Industrial />` wrapped in `<ProtectedRoute>`

### Page (`src/pages/Industrial.tsx`)
- Uses `TabbedPageLayout` with three tabs: "plant-hours", "carretas", "trucks"
- Each tab renders its own view component

### View Components (3 new files)
Each follows the same pattern used in `IndustryFuelView.tsx`:

**`src/components/industrial/PlantHoursView.tsx`**
- Table: Date, Start Hour Meter, Finish Hour Meter, Hours (calculated display)
- Add dialog with date picker, two numeric inputs
- Export dropdown (PDF/Excel) using `useExport` hook

**`src/components/industrial/CarretasView.tsx`**
- Table: Fecha/Hora Saliendo, Fecha/Hora Entrando, Tare, Payload, Weigh Ticket #
- Add dialog with datetime inputs, numeric inputs, text input
- Export dropdown (PDF/Excel)

**`src/components/industrial/TrucksView.tsx`**
- Table: Fecha/Hora Entrando, Fecha/Hora Saliendo, Tare, Payload, Weigh Ticket #, Destination Payload
- Note column order reflects trucks originating from outside (entering first)
- Add dialog, export dropdown (PDF/Excel)

### i18n (`src/i18n/en.ts`, `src/i18n/es.ts`)
- Add keys for `nav.industrial`, page title/subtitle, and field labels

### Files Changed
| File | Action |
|------|--------|
| `src/lib/permissions.ts` | Add "industrial" section |
| `src/components/layout/Sidebar.tsx` | Add nav item |
| `src/App.tsx` | Add route |
| `src/pages/Industrial.tsx` | New page |
| `src/components/industrial/PlantHoursView.tsx` | New component |
| `src/components/industrial/CarretasView.tsx` | New component |
| `src/components/industrial/TrucksView.tsx` | New component |
| `src/i18n/en.ts`, `src/i18n/es.ts` | Add translations |
| Migration SQL | 3 new tables + RLS |

