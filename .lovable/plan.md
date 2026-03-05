

## Plan: Two Backend Improvements

I recommend implementing these in the order below — journal generation is the higher-priority fix since it currently has atomicity issues and the transfer branch is new/untested.

---

### Part 1: Move Journal Generation to a Backend Function

**Problem**: The current `useJournalGeneration.ts` hook makes N sequential client-side DB calls (one journal + one journal_lines insert per transaction). If the browser disconnects mid-batch, you get orphaned journals without lines, or partially generated batches with no way to know which succeeded. There's also no transaction-level atomicity — a journal can be created but its lines fail to insert.

**Solution**: Create an edge function `generate-journals` that runs the entire batch server-side in a single invocation, using the service role client. Each journal+lines pair is inserted atomically (if lines fail, the journal is cleaned up). The frontend becomes a thin caller with a progress indicator.

**Edge Function: `supabase/functions/generate-journals/index.ts`**
- Accepts `{ user_id: string }` in the request body
- Authenticates via the standard manual JWT validation pattern (ES256)
- Role-checks: only `admin`, `management`, `accountant` can generate
- Runs the same logic currently in `useJournalGeneration.ts`:
  1. Fetch payment_method_accounts, chart_of_accounts, bank_accounts
  2. Fetch already-linked journal transaction_source_ids
  3. Fetch unlinked transactions
  4. For each unlinked transaction, determine type (investment / transfer / purchase / sale) and create journal + lines
  5. **Atomicity**: For each transaction, if `journal_lines` insert fails, delete the just-created journal
  6. Return `{ created: number, skipped: string[], total: number }`
- Add to `config.toml` with `verify_jwt = false`

**Frontend: `src/components/accounting/useJournalGeneration.ts`**
- Replace the generate() function body with a single `supabase.functions.invoke('generate-journals', { body: { user_id } })`
- Parse the response for `created`, `skipped`, `total`
- Remove progress polling (the edge function returns the final result; for UX, show an indeterminate progress bar instead of per-transaction progress)
- `countUnlinked()` can remain client-side (it's a simple read-only query)

**Frontend: `src/components/accounting/GenerateJournalsButton.tsx`**
- Switch progress bar from determinate to indeterminate while generating
- Display results from the edge function response

**Files**:
- New: `supabase/functions/generate-journals/index.ts`
- Edit: `supabase/config.toml` (add function entry)
- Edit: `src/components/accounting/useJournalGeneration.ts` (thin client)
- Edit: `src/components/accounting/GenerateJournalsButton.tsx` (indeterminate progress)

---

### Part 2: Replace Legacy ID with a Database Sequence

**Problem**: `createTransaction()` in `api.ts` fetches `MAX(legacy_id)` from the client, then inserts `MAX + 1`. Two concurrent users can get the same MAX, producing duplicate legacy_ids or a constraint violation.

**Solution**: Create a PostgreSQL sequence and a trigger that auto-assigns `legacy_id` on insert, removing the client-side logic entirely.

**Migration**:
```sql
-- Create sequence starting after the current max
DO $$
DECLARE max_id bigint;
BEGIN
  SELECT COALESCE(MAX(legacy_id), 0) INTO max_id FROM transactions;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS transactions_legacy_id_seq START WITH %s', max_id + 1);
END$$;

-- Set default
ALTER TABLE transactions
  ALTER COLUMN legacy_id SET DEFAULT nextval('transactions_legacy_id_seq');
```

**Code change: `src/lib/api.ts`**
- Remove the `MAX(legacy_id)` query block in `createTransaction()`
- Remove `legacy_id: nextLegacyId` from the insert payload — the database default handles it
- The returned row will include the auto-assigned `legacy_id`

**Files**:
- New migration for the sequence
- Edit: `src/lib/api.ts` (remove ~10 lines)

---

### Implementation Order

1. **Part 1 first** (journal generation edge function) — this is the more complex and higher-risk change
2. **Part 2 second** (legacy ID sequence) — a small, safe migration + code deletion

