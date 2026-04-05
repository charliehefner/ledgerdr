

# Intercompany Entity Groups — Implementation Plan

## Core Design Insight

The system already channels all entity access checks through **2 database functions**: `user_has_entity_access()` and `has_role_for_entity()`. By updating only these 2 functions to understand group membership, all ~50 entity-scoped RLS policies automatically gain group-aware access with **zero policy rewrites**.

```text
Current access logic:
  user_has_entity_access(entity_id) =
    is_global_admin() OR user_roles.entity_id = entity_id

New access logic:
  user_has_entity_access(entity_id) =
    is_global_admin()
    OR user_roles.entity_id = entity_id                    ← individual (unchanged)
    OR user_roles.entity_group_id = entity.entity_group_id ← NEW: group access
```

## What Changes

### Step 1 — Database Migration

**New tables:**
- `entity_groups` — group definition (name, code)
- `intercompany_transactions` — links paired journals between entities
- `intercompany_account_config` — maps GL accounts (1570/2470) per group

**Altered tables:**
- `entities` — add `entity_group_id UUID REFERENCES entity_groups(id) DEFAULT NULL`
- `bank_accounts` — add `is_shared BOOLEAN DEFAULT false`
- `user_roles` — add `entity_group_id UUID REFERENCES entity_groups(id) DEFAULT NULL`

**Updated functions (the key change):**
- `user_has_entity_access(p_entity_id)` — add group membership check
- `has_role_for_entity(p_user_id, p_role, p_entity_id)` — add group membership check
- `user_entity_ids()` — return all entity IDs in user's group (for dropdown/filters)
- `current_user_entity_id()` — unchanged (still returns first entity for defaults)

**New constraint on `user_roles`:**
```
CHECK (
  -- Global admin: both NULL
  (entity_id IS NULL AND entity_group_id IS NULL)
  -- Entity-scoped: entity_id set, group NULL
  OR (entity_id IS NOT NULL AND entity_group_id IS NULL)
  -- Group-scoped: group set, entity NULL
  OR (entity_id IS NULL AND entity_group_id IS NOT NULL)
)
```

**RLS on new tables:** Admin/Management full access; Accountant access scoped to group.

### Step 2 — Settings UI: Entity Groups Manager

New sub-section under Settings → Entidades:
- CRUD for entity groups (name, code)
- Entity edit dialog gains an optional "Group" dropdown
- Shows which entities belong to each group

### Step 3 — User Management: Group Assignment

Update the user creation/edit dialog:
- New assignment type selector: **Individual Entity** | **Entity Group** | **Global**
- When "Entity Group" is selected, show group dropdown instead of entity dropdown
- Writes `entity_group_id` to `user_roles` (with `entity_id = NULL`)
- User list shows "Group: JORD" badge for group-assigned users

### Step 4 — Bank Accounts: Shared Toggle

- Bank account form: "Shared across group" switch (visible only when entity belongs to a group)
- Transaction form payment method dropdown: when entity is in a group, include shared accounts from sibling entities (labeled with entity code)
- When a shared account from another entity is selected, show intercompany banner

### Step 5 — Intercompany Journal Generation

Update `generate-journals` edge function:
- Detect when a transaction's `pay_method` resolves to a bank account owned by a different entity in the same group
- Auto-generate paired journals:
  - **Payer entity:** DR Intercompany Receivable (1570) / CR Bank
  - **Beneficiary entity:** DR Expense / CR Intercompany Payable (2470)
- Record in `intercompany_transactions` table

### Step 6 — Intercompany Dashboard

New tab under Accounting:
- Net intercompany balances per entity pair within a group
- Drill-down to individual intercompany transactions
- "Settle" action to zero out balances with a settlement journal

### Step 7 — Consolidated Reports: Elimination Toggle

Update P&L, Balance Sheet, and Trial Balance consolidated views:
- Add "Eliminate Intercompany" toggle
- When on, subtract intercompany receivable/payable balances and any intercompany revenue/expense accounts

## What Does NOT Change

- Independent entities (no group) work exactly as today
- Chart of accounts remains global
- All existing RLS policies remain unchanged — they already call the 2 functions being updated
- Existing single-entity accountant assignments continue working
- Driver, Supervisor, Viewer roles unaffected

## Technical Detail

The entire group-awareness upgrade hinges on updating 2 SQL functions. Here's the core change to `user_has_entity_access`:

```sql
CREATE OR REPLACE FUNCTION public.user_has_entity_access(p_entity_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public AS $$
  SELECT (
    public.is_global_admin()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND entity_id = p_entity_id
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN entities e ON e.entity_group_id = ur.entity_group_id
      WHERE ur.user_id = auth.uid()
        AND ur.entity_group_id IS NOT NULL
        AND e.id = p_entity_id
    )
  );
$$;
```

This single change propagates group access to all 50+ tables automatically.

