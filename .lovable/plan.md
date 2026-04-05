

# Proactive Bug Fix: Multi-Entity Gaps

## What Caused the Schedule Issue

Yes, the Schedule problem was directly caused by the multi-entity implementation. Two things went wrong:
1. Users like `cedenojord` had `entity_id = NULL` in their role, which is only valid for admin/management "global" access — supervisors need an explicit entity assignment
2. The frontend code wasn't passing `entity_id` correctly during saves

Both have been fixed. All 14 users are now assigned to E1.

## Remaining Issues Found

My audit uncovered three categories of problems that could cause similar failures in other modules:

### Issue 1: Tables Missing Auto-Entity Default (HIGH RISK)

Six tables have an `entity_id` column but **no `DEFAULT current_user_entity_id()`** and allow NULL. If the frontend doesn't explicitly pass entity_id, inserts succeed but with `NULL` — making the record invisible to entity-scoped queries and potentially orphaned.

| Table | Affected Module |
|---|---|
| `bank_accounts` | Treasury, Petty Cash, Credit Cards |
| `fixed_assets` | Equipment / Fixed Assets |
| `contacts` | Contacts |
| `approval_policies` | Approvals |
| `approval_requests` | Approvals |
| `hr_audit_log` | HR (audit trail) |

**Fix:** Add `DEFAULT current_user_entity_id()` to each, and backfill any existing NULL rows with E1's UUID.

### Issue 2: Duplicate / Conflicting RLS Policies (MEDIUM RISK)

~30 tables have **both** old-style `has_role()` policies AND new entity-scoped `has_role_for_entity()` policies. Since PostgreSQL PERMISSIVE policies use OR logic, the old policies effectively **bypass entity isolation** — any supervisor could theoretically see another entity's data through the old policy. In a single-entity environment this is harmless, but it will become a real security issue if a second entity is added.

**Fix:** Drop the old `has_role()` policies on tables that already have `has_role_for_entity()` equivalents, and add entity-scoped policies to the 6 tables that still lack them.

### Issue 3: Frontend Components Not Filtering by Entity (LOW RISK)

Several components (BankAccountsList, CreditCardsList, PettyCashView, FixedAssetDialog, Contacts) insert records without passing `entity_id` and don't filter queries by entity. With the database default fix (Issue 1), inserts will auto-tag correctly, but queries still need `useEntityFilter` to scope results.

**Fix:** Add `useEntityFilter` to query hooks in affected components.

## Implementation Steps

1. **Database migration** — Add `DEFAULT current_user_entity_id()` to the 6 tables missing it; backfill existing NULL entity_id rows with E1's UUID
2. **Database migration** — Drop redundant old-style `has_role()` RLS policies on tables that already have entity-scoped equivalents; add entity-scoped policies to the 6 tables that lack them
3. **Frontend fixes** — Add `useEntityFilter` to BankAccountsList, CreditCardsList, PettyCashView, FixedAssetDialog, and Contacts page queries so data is properly scoped

## Risk

- All changes are additive or cleanup; no existing working functionality should break
- The backfill targets only NULL entity_id rows, so already-tagged records are untouched
- Single-entity environments see no behavioral difference, but the system is now ready for multi-entity

