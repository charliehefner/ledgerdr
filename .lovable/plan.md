

## Fix: null entity_id in service payment

**Problem**: The `register_service_partial_payment` database function inserts rows into `transactions` and `ap_ar_documents` without specifying `entity_id`. Both tables have a NOT NULL constraint on that column, causing the error.

**Root cause**: The function was written before entity-scoping was enforced. It relies on a database default (`current_user_entity_id()`) which may not resolve inside a `SECURITY DEFINER` function context.

**Fix** (single migration):

1. Alter the function to read `entity_id` from the source `service_entries` row (which already has one).
2. Pass `v_service.entity_id` explicitly into both INSERT statements:
   - `INSERT INTO transactions (... entity_id ...)` → add `v_service.entity_id`
   - `INSERT INTO ap_ar_documents (... entity_id ...)` → add `v_service.entity_id`

No frontend changes needed. The entity_id is inherited from the service entry being paid.

