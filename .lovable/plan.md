# Update Approval Policies

## Changes to `approval_policies` table

For entity `30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf`:

1. **Delete** `accountant → transaction` (was 50,000) — accountants don't enter transactions in this workflow.
2. **Delete** `accountant → journal` (was 50,000) — no approval gating on accountant journals.
3. **Delete** `supervisor → transaction` (was 10,000) — supervisor will lose transaction access entirely (see step 5).
4. **Insert** `office → transaction` at threshold **20,000**, approver = `management`.
5. **Code change in `src/lib/permissions.ts`**: Remove `supervisor` from `transactions` in both `sectionPermissions` and `writePermissions` so supervisors can no longer view or write transactions.

## SQL

```sql
DELETE FROM public.approval_policies
WHERE entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf'
  AND (
    (role_submitter = 'accountant' AND applies_to IN ('transaction','journal'))
    OR (role_submitter = 'supervisor' AND applies_to = 'transaction')
  );

INSERT INTO public.approval_policies
  (entity_id, role_submitter, applies_to, amount_threshold, approver_role, is_active)
VALUES
  ('30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf', 'office', 'transaction', 20000, 'management', true);
```

## Resulting policy state for the entity

| Submitter | Applies to  | Threshold (RD$) | Approver   |
|-----------|-------------|-----------------|------------|
| office    | transaction | 20,000          | management |

(No other policies remain active.)

## Verification

- Office user creates a transaction ≥ RD$20,000 → status `pending`, appears in Approvals queue.
- Office user creates a transaction < RD$20,000 → posts directly.
- Supervisor login no longer sees the Transactions tab in the sidebar.
