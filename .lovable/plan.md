
# Fixed Assets & Depreciation Module

## What This Does

Creates a new "Activos Fijos" (Fixed Assets) section within the existing Equipment page to track depreciable assets. On creation, it will automatically import your 10 tractors/vehicles, 17 implements, and 3 fuel tanks as fixed asset records you can fill in later.

## Database Changes

### 1. New Table: `asset_depreciation_rules`
Reference table mapping asset categories to accounting accounts:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| category | text UNIQUE | vehicle, tractor, implement, building, tools, container, office, computer, solar_panel, land_improvement, other |
| asset_account_code | text | e.g., 1240 |
| depreciation_expense_account | text | e.g., 5631 |
| accumulated_depreciation_account | text | Contra-asset |

Pre-populated with sensible defaults (account codes left as placeholders since `chart_of_accounts` is not yet populated -- you can update them later).

### 2. New Table: `fixed_assets`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| asset_code | text UNIQUE | Auto-generated FA-000001 |
| name | text | Asset description |
| category | text | Links to depreciation rules |
| acquisition_date | date | Nullable -- fill in later |
| acquisition_value | numeric(18,2) | Default 0 |
| salvage_value | numeric(18,2) | Default 0 |
| useful_life_years | integer | Default 5 |
| depreciation_method | text | 'straight_line' |
| accumulated_depreciation | numeric(18,2) | For importing partially depreciated assets |
| in_service_date | date | When depreciation starts |
| disposal_date | date | NULL until disposed |
| disposal_value | numeric(18,2) | |
| is_active | boolean | Default true |
| asset_account_code | text | From rules or manual |
| depreciation_expense_account | text | |
| accumulated_depreciation_account | text | |
| source_project_id | uuid | FK to projects (for CIP transfers) |
| equipment_id | uuid | FK to fuel_equipment |
| implement_id | uuid | FK to implements |
| serial_number | text | |
| notes | text | |
| created_at, updated_at, deleted_at | timestamptz | |

### 3. New Table: `depreciation_schedule`

Monthly depreciation entries linked to journal entries:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| asset_id | uuid FK | |
| period_date | date | First of month |
| depreciation_amount | numeric(18,2) | |
| journal_id | uuid FK | NULL until posted |
| created_at | timestamptz | |

### 4. Auto-number trigger
A trigger to auto-generate `asset_code` as FA-000001, FA-000002, etc.

### 5. RLS Policies
Standard pattern: admin/management full access, accountant can CRUD, supervisor/viewer SELECT only.

### 6. Seed Data
- Insert default depreciation rules for each category
- Import all 10 tractors from `fuel_equipment` with `equipment_id` link, copying name, serial_number, purchase_date, purchase_price where available, category = 'tractor' (or 'vehicle' for Pala Volvo)
- Import all 17 implements from `implements` with `implement_id` link, copying name, serial_number, purchase_date, purchase_price, category = 'implement'
- Import 3 fuel tanks as category = 'container'

## UI Changes

### New Tab in Equipment Page: "Activos Fijos"

Add a third tab to the existing Equipment page (`src/pages/Equipment.tsx`) with a new `FixedAssetsView` component.

**Asset List View** (`src/components/equipment/FixedAssetsView.tsx`):
- Table showing: asset_code, name, category, acquisition_date, acquisition_value, useful_life_years, accumulated_depreciation, net book value (calculated), status
- Filter by category, active/disposed
- "Agregar Activo" button to add new assets manually

**Asset Form Dialog** (`src/components/equipment/FixedAssetDialog.tsx`):
- Form fields for all editable columns
- Category dropdown auto-fills account codes from `asset_depreciation_rules`
- Supports editing existing assets (for filling in details later)

### Navigation & Permissions
- Add "fixed-assets" as a section accessible to admin, management, accountant roles
- No new route needed -- it's a tab within Equipment

## Technical Details

- Net Book Value = acquisition_value - accumulated_depreciation
- Monthly depreciation = (acquisition_value - salvage_value) / (useful_life_years * 12)
- For imported assets with no acquisition_value, depreciation is 0 until values are filled in
- The `accumulated_depreciation` field allows importing partially depreciated assets by entering the amount already taken
- CIP transfer and monthly depreciation run will be implemented in a follow-up increment
- Translation keys added for Spanish labels
