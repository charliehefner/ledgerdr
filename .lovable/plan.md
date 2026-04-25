## Fix: "Could not find the function" on Approve/Reject

### Root cause (confirmed via DB introspection)
`src/pages/Approvals.tsx` calls `supabase.rpc('approve_request', ...)` and `reject_request` when you click Aprobar/Rechazar. **Neither RPC exists in the database.** Only `get_pending_approvals` and `check_transaction_approval` are defined. PostgREST returns "Could not find the function" → toast shows the error.

The supporting schema is fully in place:
- `approval_requests` table has `status`, `reviewed_by`, `reviewed_at`, `review_note` columns.
- Both `transactions` and `journals` tables have an `approval_status` column.
- The trigger `check_transaction_approval` already inserts pending rows correctly.

### Fix — single migration creating two SECURITY DEFINER RPCs

**`approve_request(p_request_id uuid, p_note text)`**
1. Permission check: caller must be `admin` or `management` (via `has_role` / `user_roles`). Otherwise raise exception.
2. Look up the request; raise if not found or not `status='pending'`.
3. `UPDATE approval_requests SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), review_note=p_note WHERE id=p_request_id`.
4. Flip the underlying record's `approval_status` to `'approved'`:
   - If `applies_to='transaction'` → `UPDATE transactions SET approval_status='approved' WHERE id=record_id`.
   - If `applies_to='journal'` → same on `journals`.

**`reject_request(p_request_id uuid, p_note text)`**
- Same permission + lookup logic.
- Sets request `status='rejected'` and underlying record `approval_status='rejected'`.

Both functions: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, granted to `authenticated`.

### Files changed
- New SQL migration adding the two functions. No frontend changes needed — the page already calls them with the correct argument names (`p_request_id`, `p_note`).

### Risk
Low. New functions only; no schema changes, no existing logic touched. Reversible by `DROP FUNCTION` if needed.
