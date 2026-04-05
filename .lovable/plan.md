

# Security Scanner & Database Linter Results

## Scanners Run
- **Database Linter** — 11 warnings
- **Security Scanner** — 17 findings (5 errors, 12 warnings)
- **Manual DB queries** — cross-referenced all findings

---

## ERRORS (5 — must fix)

### 1. SECURITY DEFINER Views Still Active
**10 views** bypass RLS by running with the creator's privileges. The previous migration to fix these did not take effect.

| View | Sensitive Data Exposed |
|---|---|
| `v_payroll_summary` | Salaries, employee compensation |
| `general_ledger` | All journal entries and financial data |
| `trial_balance_all` | Full trial balance across entities |
| `v_trial_balance` | Trial balance data |
| `v_ap_ar_aging` | Accounts payable/receivable aging |
| `v_fuel_consumption` | Fuel usage data |
| `v_inventory_low_stock` | Inventory levels |
| `v_transactions_by_cost_center` | Transaction breakdowns |
| `v_transactions_with_dop` | Transaction details with DOP amounts |
| `employees_safe` | Employee names, positions |

**Fix:** Recreate all 10 views with `WITH (security_invoker = on)`.

### 2. `fixed_asset_depreciation_entries` — Open to All Authenticated Users
Any authenticated user (including drivers) can SELECT all depreciation entries and INSERT new ones. No role or entity check.

**Fix:** Replace open policies with `has_role_for_entity()` checks restricted to admin/management/accountant.

### 3. Storage Buckets — All Authenticated Users Can Read All Files
- `employee-documents` bucket: any authenticated user can read all employee documents (IDs, contracts)
- `transaction-attachments` bucket: any authenticated user can read all financial attachments

**Fix:** Add entity/ownership checks to storage SELECT policies.

### 4. `has_role()` Cross-Entity INSERT Access
~40 tables still use old `has_role()` in policies. An accountant for Entity A could insert records into Entity B by supplying a different `entity_id`.

**Fix:** Drop the 143 legacy `has_role()` policies on tables that already have entity-scoped equivalents (this was supposed to happen in the last migration but didn't apply).

### 5. `service_providers` — Banking Data Readable by All
The `service_providers` table exposes `cedula` (national ID), `bank`, `bank_account_number` to any authenticated user via `USING (true)` SELECT policy.

**Fix:** Restrict SELECT to admin/management/accountant/supervisor roles.

---

## WARNINGS (12 — should fix)

### 6. 2 Functions Missing `search_path`
Two database functions don't set `search_path`, making them vulnerable to schema poisoning.

### 7. Extension in Public Schema
An extension is installed in the `public` schema (platform default, low risk).

### 8. 7 Tables with `USING (true)` / `WITH CHECK (true)` Policies
| Table | Open Operations |
|---|---|
| `tractor_operators` | SELECT, INSERT, UPDATE, DELETE (fully open) |
| `transportation_units` | SELECT, INSERT, UPDATE, DELETE (fully open) |
| `fixed_asset_depreciation_entries` | SELECT, INSERT |
| `service_providers` | SELECT |
| `service_entries` / `service_entry_payments` | SELECT |
| `alert_configurations` / `exchange_rates` / `rainfall_records` | SELECT |
| `tss_parameters` / `vendor_account_rules` / `payment_method_accounts` | SELECT |

**Fix:** Restrict write access on `tractor_operators` and `transportation_units` to admin/management/supervisor. The SELECT-only `USING (true)` tables are acceptable for read-only reference data.

### 9. Leaked Password Protection Disabled
A platform-level setting. Cannot be changed programmatically. Already marked as ignored.

### 10. AI Search Edge Function — No Auth Check
The `ai-search` function doesn't validate JWT tokens. Anyone with the URL can query operational data.

**Fix:** Add JWT validation to the edge function.

### 11. Client-Side Role Checks
UI-only permission checks (low risk since RLS enforces server-side).

### 12. No UPDATE Policy on Storage Buckets
Missing explicit UPDATE deny policies on storage buckets (updates blocked by default, but should be explicit).

---

## Implementation Plan

### Step 1 — Database Migration
1. Recreate 10 views with `security_invoker = on` (re-attempt previous failed migration)
2. Drop ~143 legacy `has_role()` policies on tables with entity-scoped equivalents
3. Replace open policies on `fixed_asset_depreciation_entries` with role-based ones
4. Restrict `tractor_operators` and `transportation_units` write to admin/management/supervisor
5. Restrict `service_providers` SELECT to authorized roles
6. Fix 2 functions missing `search_path`

### Step 2 — Storage Policies
1. Tighten `employee-documents` SELECT to check entity/role
2. Tighten `transaction-attachments` SELECT to check entity/role
3. Add explicit UPDATE deny policies

### Step 3 — Edge Function Auth
1. Add JWT validation to `ai-search` function

### Step 4 — Verify
1. Re-run security scanner and linter to confirm all errors resolved

