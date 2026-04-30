## Problem

The HR → Payroll period summary table is blank because the "Preview" RPC call fails silently (the React component swallows the RPC error into `rpcError` state and returns `[]`).

## Root cause

There are **two overloaded versions** of `calculate_payroll_for_period` in the database with the same parameter names but in different positions:

1. `(p_period_id uuid, p_commit boolean, p_entity_id uuid)` — older signature
2. `(p_period_id uuid, p_entity_id uuid, p_commit boolean)` — newer signature

The client calls it with named parameters:
```ts
supabase.rpc("calculate_payroll_for_period",
  { p_period_id, p_commit: false, p_entity_id })
```

PostgREST cannot disambiguate between two overloads that accept the exact same set of named parameters, and returns `PGRST203` ("Could not choose the best candidate function"). The component catches this, sets `rpcError`, and shows an empty table.

## Fix

Drop the older/duplicate overload so only one version remains. Inspecting both bodies, version #2 (oid 109514) is the newer one but has a different return signature. Version #1 (oid 108907) matches the columns the React component (`PayrollRpcRow`) expects (`employee_id, employee_name, salary, base_pay, …, committed`), so we keep #1 and drop #2.

```sql
DROP FUNCTION IF EXISTS public.calculate_payroll_for_period(
  uuid, uuid, boolean
);
```

This restores a single, unambiguous function callable by named parameters.

## Verification steps after migration

1. Open HR → Payroll → select a period → click "Vista Previa".
2. Confirm the summary table populates with employees, gross, TSS, ISR, net.
3. Re-test on a closed period to ensure snapshots still display (unchanged path).
4. Confirm "Comprometer Nómina" still works on an open period.

## Files / objects touched

- New migration: `DROP FUNCTION public.calculate_payroll_for_period(uuid, uuid, boolean)`.
- No application code changes required.
