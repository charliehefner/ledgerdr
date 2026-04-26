# Phase 1: Posting Rules Engine (Silent Auto-Apply)

## Principle
Rules fill fields silently on the transaction form, exactly as if the user had typed them. The person entering already visually confirms every field before saving, so no "suggested by rule" chips, tooltips, or confirmation prompts are added. Accountants verify correctness at the Journal stage, where rule provenance is available for audit.

## Scope

### 1. Database — new migration
- **`posting_rules`** table
  - `id`, `entity_id` (nullable = global), `name`, `priority` (int, lower = first), `is_active`
  - `conditions jsonb` — supports: `vendor_regex`, `description_regex`, `ncf_prefix` (e.g. B01, B11, B14), `amount_min`, `amount_max`, `currency`, `transaction_type` (purchase/sale/transfer)
  - `actions jsonb` — supports: `master_account_code`, `project_id`, `cost_center`, `cbs_code`, `append_note`
  - `created_by`, `created_at`, `updated_at`
  - RLS: read for Accountant+/Admin/Mgmt within entity scope; write for Admin/Accountant only
- **`posting_rule_applications`** audit table
  - `id`, `transaction_id`, `rule_id`, `applied_fields jsonb`, `applied_at`
  - Written silently by the form when a rule fills a field
- **`evaluate_posting_rules(p_entity_id, p_payload jsonb)` RPC**
  - Returns ordered list of `{ rule_id, actions }` matching the payload
  - Stable, security definer, scoped by entity_id

### 2. Settings UI — `src/components/settings/PostingRulesManager.tsx` (new)
- List rules grouped by entity (or "Global")
- Create/edit dialog with condition + action builders
- Drag-to-reorder priority
- "Test against recent transactions" panel — paste or pick a recent transaction, see which rules match
- Toggle active/inactive
- Visible only to Admin and Accountant roles

### 3. Client evaluator — `src/lib/postingRules.ts` (new)
- Thin wrapper around the RPC
- Called on blur/change of trigger fields: vendor, description, NCF/document, amount, currency
- Returns merged actions (highest-priority rule wins per field)

### 4. Transaction form integration — `src/components/transactions/TransactionForm.tsx`
- On relevant field change, call evaluator
- Apply returned actions only to fields the user has not manually edited (track `dirtyFields`)
- No new visible UI elements
- Log applied rule IDs to `posting_rule_applications` on successful submit

### 5. Quick Entry refactor — `src/components/accounting/QuickEntryDialog.tsx`
- Remove hardcoded `AUTO_RULES` regex constant
- Call the same evaluator
- Seed migration inserts the four existing hardcoded rules (COMISIÓN→6520, IMPUESTO LEY→6530, ITBIS→1650, INTERÉS→6510) as global `posting_rules` rows so behavior is preserved

### 6. i18n
- Add Spanish/English keys only for Settings → Posting Rules manager (table headers, condition/action labels, buttons). No new keys on the transaction form since no new UI is added there.

## Out of scope for Phase 1
- Generating extra journal lines from rules (Phase 2)
- Rule execution inside `generate-journals` edge function (Phase 2)
- "Why this account?" tooltip on Journal view (Phase 3 — uses the audit table written in Phase 1)

## Limitations & guardrails
- **Manual override always wins.** Once a user edits a field, rules cannot retouch it within that form session.
- **No bypass of validation.** Rules can only set values that the user could have typed; all existing form validations still run.
- **No silent account creation.** Rule actions referencing a missing account code are skipped and logged, not auto-created.
- **Performance.** Evaluator is called on field blur/change, not on every keystroke. RPC is `STABLE` and indexed by `entity_id` + `priority`.
- **Conflict between rules.** Resolved strictly by `priority`, then by `created_at`. Documented in the manager UI.

## Files
- `supabase/migrations/<timestamp>_posting_rules.sql` *(new)*
- `src/components/settings/PostingRulesManager.tsx` *(new)*
- `src/lib/postingRules.ts` *(new)*
- `src/components/transactions/TransactionForm.tsx` *(modify)*
- `src/components/accounting/QuickEntryDialog.tsx` *(modify — remove hardcoded regex)*
- `src/pages/Settings.tsx` *(modify — add Posting Rules tab)*
- `src/i18n/es.ts`, `src/i18n/en.ts` *(modify — Settings keys only)*

## Validation after build
1. Create a rule: vendor matches `/EDESUR/i` → master account `6110` (Electricidad).
2. Enter a new purchase from EDESUR → account field auto-fills to 6110, no badge shown.
3. Manually change account to 6120 → save. Verify the manual choice persisted.
4. Open Journal generated from this transaction → verify it posted to 6120 (manual override respected).
5. Query `posting_rule_applications` → verify the rule application was logged even though it was overridden (useful for "rule fired but user changed it" analytics later).
