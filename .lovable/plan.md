# Posting Rules — Phase 1.5: Credit Account + Conflict Detection

## A. Optional credit account on rule actions

**Why:** ~95% of transactions auto-resolve the credit side correctly (bank for cash purchases, AP for B01 credit purchases, AR for sales). But for **reclassifications**, **specific accruals**, or **non-standard liability postings**, accountants need to direct *both* sides via a rule.

**Migration**
- New column `transactions.manual_credit_account_code TEXT NULL` — set by the rule engine at entry time, honored by `generate-journals`.
- `actions` JSONB gains an optional `credit_account_code` key (no schema change — JSONB).
- `evaluate_posting_rules` RPC: pass `credit_account_code` through in returned actions.

**Manager UI — `PostingRulesManager.tsx`**
- Rename "Cuenta maestra" → **"Cuenta de débito"**.
- Add **"Cuenta de crédito (opcional)"** input below it.
- Help text: *"Déjelo vacío para usar la cuenta automática (banco / cuentas por pagar / cuentas por cobrar según el tipo de transacción)."*

**Client wrapper — `src/lib/postingRules.ts`**
- Add `credit_account_code?: string` to `PostingRuleAction`.
- Update `mergeRuleActions` to merge it (first-match-wins, like other fields).

**Transaction form — `src/components/transactions/TransactionForm.tsx`**
- **No new visible field.** When a matching rule provides `credit_account_code`, store it silently into `manual_credit_account_code` on the transaction row. The data-entry person never sees this — it's an accountant-side directive.

**Edge function — `supabase/functions/generate-journals/index.ts`**
- When generating journal lines, if `transaction.manual_credit_account_code` is set:
  - Validate the account exists in `chart_of_accounts`.
  - If valid → use it as the credit side instead of the auto-resolved bank/AP/AR.
  - If missing → fall back to auto and write a warning to `error_logs` (don't block the journal).

## B. Conflict detection — design time, not entry time

**Why not at entry time:** the user already chose silent auto-fill specifically to keep entry friction-free. Data-entry staff aren't accountants and shouldn't be asked to arbitrate rule conflicts. Real conflicts are a *rule-design bug*, best caught where the accountant builds rules.

**Manager UI — `PostingRulesManager.tsx`**
- On save (create or edit), run a client-side conflict check:
  - Find all other *active* rules at the **same `priority`** with **overlapping `entity_id` scope** (same entity, or both global).
  - For each action field (`master_account_code`, `credit_account_code`, `project_code`, `cbs_code`, `cost_center`), if two rules set the same field to different values → flag.
- Display an inline warning banner before save:
  - Lists the conflicting rule(s) by name and the colliding field(s).
  - Two actions: **"Continuar de todas formas"** (soft override — save) or **"Cambiar prioridad"** (focus the priority field with a suggested gap).
- Soft warning, never a hard block — the accountant has final authority.

**No changes** to `TransactionForm` or `QuickEntryDialog`. Entry-time silent auto-apply behavior is unchanged.

## C. Phase 3 preview (not in this round)

To set expectations for the next round:
- Journal view will gain a **"⚠ Multiple rules matched"** badge per line and a **"Why this account?"** tooltip reading from `posting_rule_applications`.
- That's where the accountant gets full conflict visibility during journal review and posting — the right moment, the right person.

## Files
- `supabase/migrations/<ts>_posting_rules_credit_overrides.sql` *(new — `manual_credit_account_code` column + verify RPC passes credit code through)*
- `src/lib/postingRules.ts` *(modify — add `credit_account_code` to interface and merge logic)*
- `src/components/settings/PostingRulesManager.tsx` *(modify — credit account input + conflict detector)*
- `src/components/transactions/TransactionForm.tsx` *(modify — silently persist `manual_credit_account_code` when rule provides it)*
- `supabase/functions/generate-journals/index.ts` *(modify — honor `manual_credit_account_code` with validation + fallback)*
- `src/i18n/es.ts`, `src/i18n/en.ts` *(modify — new manager labels only)*

## Validation
1. Create rule "Reclasificación EDESUR mal clasificado" → debit=`6110`, credit=`6190`. Save.
2. Enter a purchase that matches → check the journal: debit `6110`, credit `6190` (not the bank).
3. Enter a normal EDESUR purchase paid from bank → standard rule (no credit override) applies → debit `6110`, credit = bank account. No regression.
4. Create a second rule at the **same priority** that also sets `master_account_code` for an overlapping vendor pattern → manager shows conflict warning naming both rules and field.
5. Lower the new rule's priority → warning disappears, save proceeds clean.
6. Set `credit_account_code` to a non-existent code → enter matching transaction → journal posts with the auto credit (fallback) and an entry appears in `error_logs`.

## Limitations
- Credit override is only visible in the **journal**, not the transaction list. By design — accountants work from journals.
- Conflict detection is heuristic: it catches **same-priority, same-field** collisions. It cannot predict overlapping regex matches across *different* priorities — priority is the documented tiebreaker for that case.
- We deliberately do **not** add a credit-account field on the entry form. Only rules (or an accountant editing the journal directly in Phase 3) can set it.
- Manual user override on the **debit** account still wins over rules in the entry form, exactly as today.