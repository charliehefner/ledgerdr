
Goal: do a second, broader entity-scoping audit instead of assuming the single payment RPC fix was enough.

What I found
- The last migration did fix `register_service_partial_payment` itself: it now inserts `v_service.entity_id` into `ap_ar_documents` and `transactions`.
- But the surrounding service flow still looks inconsistent:
  - `ServicesView.tsx` inserts/updates `service_entries` without using `requireEntity()` or an explicit `entity_id`.
  - `ServicesView.tsx` reads `service_entries` without `useEntityFilter()`.
  - `ServicePaymentDialog.tsx` updates `service_entries` after the RPC without entity-aware guarding.
  - Generated types still show `service_entries` and `service_entry_payments` without `entity_id`, and the RPC still has two signatures, which suggests schema/type drift and increases the risk that other entity bugs were missed.
- Older migrations show `service_entries` was originally created without `entity_id`, so this area likely needs a full reconciliation, not just one patch.

Implementation plan

1. Re-audit the service-payment data model
- Verify whether `service_entries`, `service_entry_payments`, and `service_providers` actually have `entity_id` in the backend today.
- Verify RLS/policies for those tables match the current multi-entity model.
- Confirm whether any triggers/defaults are still masking missing explicit entity assignment.

2. Harden the HR service flow end-to-end
- Update the service creation/edit flow to require a selected entity before any write.
- Explicitly pass `entity_id` on inserts where the table is entity-scoped instead of relying on defaults.
- Apply entity-aware filtering to service list queries so reads match the selected entity context.
- Ensure payment follow-up updates only operate within the selected entity context.

3. Reconcile backend function drift
- Review all versions/usages of `register_service_partial_payment` and remove legacy signature drift so app types and runtime behavior match.
- Audit other `SECURITY DEFINER` functions that insert into entity-scoped tables and make them propagate `entity_id` explicitly from the source record or validated input.

4. Run a broader entity bug sweep in high-risk areas
- Search for write paths that:
  - insert into tables with `NOT NULL entity_id`
  - depend on `current_user_entity_id()`
  - are callable in “All Entities” mode
  - use RPC/database functions instead of direct inserts
- Prioritize HR, Accounting, Treasury, AP/AR, and Operations payment/journal flows.

5. Close the gaps with consistency safeguards
- Align generated types with the real backend schema so missing `entity_id` shows up immediately in code.
- Standardize a rule: all write-capable screens must use `requireEntity()` and all entity-scoped reads must use `useEntityFilter()` unless intentionally consolidated.
- Add at least one focused regression check for the service flow:
  - create service
  - list service under entity filter
  - register partial payment
  - verify linked AP/AR + transaction records inherit the same entity

Technical details
- Files already showing risk:
  - `src/components/hr/ServicesView.tsx`
  - `src/components/hr/ServicePaymentDialog.tsx`
  - `src/integrations/supabase/types.ts`
  - service-related migrations under `supabase/migrations/`
- Likely backend work:
  - one or more migrations to reconcile service-table entity columns and any dependent functions/policies
- Likely frontend work:
  - add `useEntity()` / `useEntityFilter()` to the HR service screens
  - explicit `entity_id` propagation on inserts
  - tighter query filters for bank/service-related reads where needed

Expected outcome
- The service-payment bug is fixed at the source and the whole HR service module becomes consistent with the project’s multi-entity architecture, reducing the chance of more “null entity_id” failures appearing one screen later.
