

## Proactive Weak Spot Scan - Full Results

I scanned the entire codebase for patterns that could cause crashes, hangs, or silent failures. Here are the findings:

---

### 1. `.single()` used where `.maybeSingle()` is safer (Crash Risk)

Using `.single()` on SELECT queries throws an error if zero rows are returned. For INSERT/UPDATE `.select().single()` this is fine (you just created/updated the row). But for pure lookups, if the row doesn't exist, the app crashes.

| File | Line | Risk | Recommendation |
|------|------|------|----------------|
| `delete-user/index.ts` | ~102 | `scheduled_user_deletions` lookup with `.single()` | Switch to `.maybeSingle()` -- no pending deletion is a valid state |
| `EmployeeFormDialog.tsx` | ~107 | Employee lookup by ID with `.single()` | Switch to `.maybeSingle()` -- defensive if employee was just deleted |
| `EmployeeDetailDialog.tsx` | ~87 | Employee lookup by ID with `.single()` | Switch to `.maybeSingle()` |
| `PurchaseHistoryDialog.tsx` | ~37 | Inventory item lookup by ID with `.single()` | Switch to `.maybeSingle()` |
| `InventoryItemDialog.tsx` | ~78 | Inventory item lookup by ID with `.single()` | Switch to `.maybeSingle()` |

**Note:** `.single()` in `api.ts` and `OperationsLogView.tsx` after INSERT/UPDATE is correct and does not need changing.

---

### 2. `handleDeleteUser` has no loading state (Minor UX)

In `UserManagement.tsx`, `handleDeleteUser` (line 125) does not set any loading/disabled state. If the network is slow, users can click "Delete" multiple times, potentially scheduling duplicate deletions. The edge function guards against this, but the UX should prevent double-clicks.

**Fix:** Add a `deletingUserId` state and disable the delete button while the request is in flight.

---

### 3. `handleUpdateRole` -- implementation hidden, needs verification

The function at line 150 shows `// ... keep existing code`. It should be verified to have proper try/catch and error handling.

---

### Summary

| Category | Count | Severity |
|----------|-------|----------|
| `.single()` should be `.maybeSingle()` | 5 | Medium -- can crash queries |
| Missing loading guard on delete | 1 | Low -- UX double-click |
| Total fixes | 6 | |

All other major patterns (isMounted guards, try/catch/finally, attachment signed URLs) are already implemented correctly across the codebase.

---

### Technical Implementation

1. **5 files**: Replace `.single()` with `.maybeSingle()` on SELECT-only queries and add null-checks where needed
2. **UserManagement.tsx**: Add `deletingUserId` state to prevent double-click on user deletion
3. **Verify** `handleUpdateRole` has proper error handling (will read the actual content during implementation)

