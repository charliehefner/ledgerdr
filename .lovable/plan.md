

# Standardize payroll_snapshots Management Policy Name

## Problem
The `payroll_snapshots` table has a management policy named `"Management has full access to payroll snapshots"` instead of the standard `"Management full access"` used on all other tables.

## Plan

### 1. Database migration
- Drop the existing policy `"Management has full access to payroll snapshots"` on `payroll_snapshots`
- Create replacement policy `"Management full access"` on `payroll_snapshots` with the same logic: `FOR ALL USING (public.has_role(auth.uid(), 'management'))`

### 2. Update rlsPoliciesSql.ts
Verify the backup file already uses the standard name (it does per prior analysis), so no code change needed.

### Files Modified
- New migration only

