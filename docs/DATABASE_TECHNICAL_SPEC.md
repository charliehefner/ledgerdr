# Database Technical Specification

**Application:** Ledger DR (Agricultural Farm Management System)  
**Generated:** January 2026  
**Database:** PostgreSQL (via Supabase)

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [Row-Level Security Policies](#row-level-security-policies)
3. [Roles & Permissions Matrix](#roles--permissions-matrix)
4. [Identity Fields](#identity-fields)
5. [Database Functions](#database-functions)
6. [Storage Buckets](#storage-buckets)

---

## Database Schema

### Core Financial Tables

#### `transactions`
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| legacy_id | integer | Yes | - | Reference to legacy system |
| transaction_date | date | No | - | Date of transaction |
| description | text | No | '' | Transaction description |
| amount | numeric | No | 0 | Transaction amount |
| currency | text | No | 'DOP' | Currency code |
| itbis | numeric | Yes | - | Tax amount |
| name | text | Yes | - | Payee/vendor name |
| document | text | Yes | - | Document reference number |
| pay_method | text | Yes | - | Payment method |
| master_acct_code | text | Yes | - | Master account code |
| cbs_code | text | Yes | - | CBS code reference |
| project_code | text | Yes | - | Project code reference |
| comments | text | Yes | - | Additional comments |
| is_void | boolean | No | false | Void status |
| void_reason | text | Yes | - | Reason for voiding |
| voided_at | timestamptz | Yes | - | When voided |
| created_at | timestamptz | No | now() | Creation timestamp |
| updated_at | timestamptz | No | now() | Last update timestamp |

#### `accounts`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| code | text | No | - |
| english_description | text | No | - |
| spanish_description | text | No | - |
| created_at | timestamptz | No | now() |

#### `projects`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| code | text | No | - |
| english_description | text | No | - |
| spanish_description | text | No | - |
| created_at | timestamptz | No | now() |

#### `cbs_codes`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| code | text | No | - |
| english_description | text | No | - |
| spanish_description | text | No | - |
| created_at | timestamptz | No | now() |

#### `transaction_attachments`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| transaction_id | text | No | - |
| attachment_url | text | No | - |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `transaction_edits`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| transaction_id | text | No | - |
| document | text | Yes | - |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

---

### HR Tables

#### `employees`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| cedula | text | No | - |
| name | text | No | - |
| position | text | No | 'Obrero' |
| salary | numeric | No | 0 |
| date_of_hire | date | No | - |
| date_of_birth | date | Yes | - |
| is_active | boolean | No | true |
| bank | text | Yes | - |
| bank_account_number | text | Yes | - |
| shirt_size | text | Yes | - |
| pant_size | text | Yes | - |
| boot_size | text | Yes | - |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

**Valid positions:** Obrero, Volteador, Sereno, Tractorista, Supervisor, Administrativa, Gerencia

#### `employee_timesheets`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| period_id | uuid | No | - |
| work_date | date | No | - |
| start_time | time | Yes | - |
| end_time | time | Yes | - |
| hours_worked | numeric | Yes | - |
| is_absent | boolean | No | false |
| is_holiday | boolean | No | false |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

**Unique constraint:** (employee_id, work_date)

#### `payroll_periods`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| start_date | date | No | - |
| end_date | date | No | - |
| status | text | No | 'open' |
| is_current | boolean | No | false |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `employee_benefits`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| benefit_type | text | No | - |
| amount | numeric | No | 0 |
| is_recurring | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `period_employee_benefits`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| period_id | uuid | No | - |
| employee_id | uuid | No | - |
| benefit_type | text | No | - |
| amount | numeric | No | 0 |
| created_at | timestamptz | No | now() |

#### `employee_salary_history`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| effective_date | date | No | - |
| salary | numeric | No | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |

#### `employee_vacations`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| start_date | date | No | - |
| end_date | date | No | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |

#### `employee_documents`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| document_type | text | No | - |
| document_name | text | No | - |
| storage_path | text | No | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |

#### `employee_incidents`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| employee_id | uuid | No | - |
| incident_date | date | No | - |
| description | text | No | - |
| severity | text | Yes | - |
| resolution | text | Yes | - |
| created_at | timestamptz | No | now() |

#### `day_labor_entries`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| worker_name | text | No | - |
| work_date | date | No | - |
| week_ending_date | date | No | - |
| operation_description | text | No | - |
| amount | numeric | No | 0 |
| is_closed | boolean | No | false |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

---

### Operations & Farm Tables

#### `farms`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| name | text | No | - |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `fields`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| farm_id | uuid | No | - |
| name | text | No | - |
| hectares | numeric | Yes | - |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `operation_types`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| name | text | No | - |
| is_mechanical | boolean | No | true |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |

#### `operations`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| operation_date | date | No | CURRENT_DATE |
| operation_type_id | uuid | No | - |
| field_id | uuid | No | - |
| tractor_id | uuid | Yes | - |
| implement_id | uuid | Yes | - |
| hectares_done | numeric | No | - |
| workers_count | integer | Yes | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `operation_inputs`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| operation_id | uuid | No | - |
| inventory_item_id | uuid | No | - |
| quantity_used | numeric | No | - |
| created_at | timestamptz | No | now() |

---

### Equipment Tables

#### `fuel_equipment`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| name | text | No | - |
| equipment_type | text | No | - |
| brand | text | Yes | - |
| model | text | Yes | - |
| serial_number | text | Yes | - |
| hp | numeric | Yes | - |
| current_hour_meter | numeric | No | 0 |
| purchase_date | date | Yes | - |
| purchase_price | numeric | Yes | - |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `implements`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| name | text | No | - |
| implement_type | text | No | - |
| brand | text | Yes | - |
| model | text | Yes | - |
| serial_number | text | Yes | - |
| purchase_date | date | Yes | - |
| purchase_price | numeric | Yes | - |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `fuel_tanks`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| name | text | No | - |
| use_type | text | No | - |
| fuel_type | text | No | 'diesel' |
| capacity_gallons | numeric | No | - |
| current_level_gallons | numeric | No | 0 |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

#### `fuel_transactions`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| tank_id | uuid | No | - |
| equipment_id | uuid | Yes | - |
| transaction_type | text | No | - |
| transaction_date | timestamptz | No | now() |
| gallons | numeric | No | - |
| hour_meter_reading | numeric | Yes | - |
| previous_hour_meter | numeric | Yes | - |
| gallons_per_hour | numeric | Yes | - |
| pump_start_reading | numeric | Yes | - |
| pump_end_reading | numeric | Yes | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |

---

### Inventory Tables

#### `inventory_items`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| commercial_name | text | No | - |
| molecule_name | text | Yes | - |
| function | inventory_function | No | 'other' |
| supplier | text | Yes | - |
| purchase_unit_type | text | No | 'unit' |
| purchase_unit_quantity | numeric | No | 1 |
| use_unit | text | No | 'kg' |
| sack_weight_kg | numeric | Yes | - |
| price_per_purchase_unit | numeric | No | 0 |
| current_quantity | numeric | No | 0 |
| co2_equivalent | numeric | Yes | - |
| is_active | boolean | No | true |
| created_at | timestamptz | No | now() |
| updated_at | timestamptz | No | now() |

**Enum `inventory_function`:** fertilizer, fuel, pre_emergent_herbicide, post_emergent_herbicide, pesticide, fungicide, insecticide, seed, other

#### `inventory_purchases`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| item_id | uuid | No | - |
| purchase_date | date | No | CURRENT_DATE |
| quantity | numeric | No | - |
| unit_price | numeric | No | - |
| total_price | numeric | No | - |
| packaging_unit | text | No | 'unit' |
| packaging_quantity | numeric | No | 1 |
| supplier | text | Yes | - |
| document_number | text | Yes | - |
| notes | text | Yes | - |
| created_at | timestamptz | No | now() |

---

### Authentication & Authorization

#### `user_roles`
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| user_id | uuid | No | - |
| role | app_role | No | - |
| created_at | timestamptz | No | now() |

**Enum `app_role`:** admin, accountant

---

## Row-Level Security Policies

### Policy Pattern

All tables follow a consistent RLS pattern:
- **Admin**: Full access (SELECT, INSERT, UPDATE, DELETE)
- **Accountant**: Varies by table (typically SELECT + INSERT, sometimes UPDATE)

### Policies by Table

| Table | Admin | Accountant SELECT | Accountant INSERT | Accountant UPDATE | Accountant DELETE |
|-------|-------|-------------------|-------------------|-------------------|-------------------|
| accounts | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| cbs_codes | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| projects | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| transactions | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| transaction_attachments | ✅ ALL | ✅ | ✅ | ❌ | ❌ |
| transaction_edits | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| employees | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| employee_timesheets | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| employee_benefits | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| employee_documents | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| employee_incidents | ✅ ALL | ❌ | ❌ | ❌ | ❌ |
| employee_salary_history | ✅ ALL | ❌ | ❌ | ❌ | ❌ |
| employee_vacations | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| payroll_periods | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| period_employee_benefits | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| day_labor_entries | ✅ ALL | ✅ | ✅ | ✅ | ✅* |
| farms | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| fields | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| operation_types | ✅ ALL | ✅ | ❌ | ❌ | ❌ |
| operations | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| operation_inputs | ✅ ALL | ✅ | ✅ | ✅ | ✅ |
| fuel_equipment | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| fuel_tanks | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| fuel_transactions | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| implements | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| inventory_items | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| inventory_purchases | ✅ ALL | ✅ | ✅ | ✅ | ❌ |
| user_roles | ✅ ALL | Own only | ❌ | ❌ | ❌ |

*Accountants can only delete day_labor_entries where `is_closed = false`

### RLS Helper Functions

```sql
-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;
```

---

## Roles & Permissions Matrix

### Application Roles

| Role | Description |
|------|-------------|
| **admin** | Full system access. Can modify settings, void transactions, manage users, view sensitive data (incidents, salary history). |
| **accountant** | Day-to-day operations. Can enter transactions, timesheets, fuel logs. Cannot modify system configuration or void transactions. |

### Feature-Level Permissions

| Feature | Admin | Accountant |
|---------|-------|------------|
| **Transactions** | Create, Edit, Void, Delete | Create, View |
| **Transaction Attachments** | Full | Upload, View |
| **Accounts/Projects/CBS Codes** | Full CRUD | View Only |
| **Employees** | Full CRUD | View Only |
| **Employee Timesheets** | Full | Create, Edit, View |
| **Employee Salary History** | Full | No Access |
| **Employee Incidents** | Full | No Access |
| **Payroll Periods** | Full CRUD | View Only |
| **Day Labor** | Full | Create, Edit, Delete (open only) |
| **Farms & Fields** | Full CRUD | View Only |
| **Operations** | Full | Create, Edit, View |
| **Fuel Equipment** | Full | Create, Edit, View |
| **Fuel Tanks** | Full | Create, Edit, View |
| **Fuel Transactions** | Full | Create, Edit, View |
| **Implements** | Full | Create, Edit, View |
| **Inventory Items** | Full | Create, Edit, View |
| **Settings Page** | Full Access | No Access |
| **User Management** | Full CRUD | No Access |
| **Database Backup** | Can Download | No Access |

---

## Identity Fields

### User Authentication (`auth.users` - Supabase managed)

| Field | Purpose |
|-------|---------|
| `id` (uuid) | Primary user identifier, referenced by `user_roles.user_id` |
| `email` | Login credential and display identifier |

### Application Identity Linking

```
auth.users.id ──────────────────────┐
                                    │
user_roles.user_id ─────────────────┤ (Application role assignment)
                                    │
                                    ▼
                            RLS policies use auth.uid()
                            to check has_role(auth.uid(), 'admin')
```

### Employee Identity (Separate from User Auth)

| Field | Table | Purpose |
|-------|-------|---------|
| `cedula` | employees | National ID number (Dominican Republic) |
| `name` | employees | Full name |
| `bank_account_number` | employees | Payment routing |

**Note:** Employees are **not** linked to auth.users. They are farm workers tracked for payroll, not system users.

### Entity Relationships

```
farms
  └── fields (farm_id → farms.id)
        └── operations (field_id → fields.id)
              ├── operation_type_id → operation_types.id
              ├── tractor_id → fuel_equipment.id
              ├── implement_id → implements.id
              └── operation_inputs (operation_id → operations.id)
                    └── inventory_item_id → inventory_items.id

fuel_equipment
  └── fuel_transactions (equipment_id → fuel_equipment.id)
        └── tank_id → fuel_tanks.id

employees
  ├── employee_timesheets (employee_id → employees.id)
  │     └── period_id → payroll_periods.id
  ├── employee_benefits (employee_id → employees.id)
  ├── employee_salary_history (employee_id → employees.id)
  ├── employee_vacations (employee_id → employees.id)
  ├── employee_documents (employee_id → employees.id)
  └── employee_incidents (employee_id → employees.id)

inventory_items
  └── inventory_purchases (item_id → inventory_items.id)
```

---

## Database Functions

### `update_updated_at_column()`
Trigger function to automatically set `updated_at` on row updates.

### `has_role(_user_id uuid, _role app_role)`
Security definer function to check user roles without RLS recursion.

### `get_user_role(_user_id uuid)`
Security definer function to retrieve a user's role.

---

## Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `transaction-attachments` | No | Invoice scans, receipts |
| `employee-documents` | No | HR documents, contracts |

**Access:** Via signed URLs generated by `get-signed-url` Edge Function (1-hour expiry).

---

## Migration Notes for Corporate IT

### To Replace Supabase Auth with SSO:

1. Replace `auth.uid()` calls in RLS policies with your identity provider's user ID
2. Modify `user_roles` table to reference your user directory
3. Update `has_role()` and `get_user_role()` functions
4. Refactor `src/contexts/AuthContext.tsx` to use your SSO provider
5. Update Edge Functions that use `SUPABASE_SERVICE_ROLE_KEY` for user management

### Required Secrets:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database connection |
| `SUPABASE_ANON_KEY` | Client-side API access |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations (user creation) |
| `SUPABASE_DB_URL` | Direct database connection |
| `DALLAS_AGRO_API_KEY` | External API integration |
