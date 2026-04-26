# Posting Rules — Phase 2: Extra Journal Lines (Server-Side Splits / Accruals)

## Goal

Let a rule add **additional balanced journal lines** when `generate-journals` builds the entry. This moves rules from "fill fields on the transaction" → "shape the journal itself."

## Use cases (from the user)

1. **Auto-split cost centers** — every fuel purchase: 70% Agrícola / 30% Industrial.
2. **Auto-withholding accrual** — every B11 invoice: book 1% to a tax-liability account.
3. **Per-vendor surcharge/rebate** — fixed amount or % to a designated account.
4. **(Deferred to Phase 2.5)** Multi-period amortization (rent spread over 12 periods) — needs period scheduling, intentionally **not** in this round.

## Data model — JSONB only, no migration

`actions.extra_lines` (new optional key on the existing `posting_rules.actions` JSONB):

```json
{
  "master_account_code": "5110",
  "extra_lines": [
    { "account_code": "5110", "side": "debit",  "split": { "type": "percent", "value": 70 }, "cost_center": "agricultural", "description": "Diésel — Agrícola" },
    { "account_code": "5110", "side": "debit",  "split": { "type": "percent", "value": 30 }, "cost_center": "industrial",  "description": "Diésel — Industrial" },
    { "account_code": "2170", "side": "credit", "split": { "type": "percent", "value": 1  },                                 "description": "ISR Retenido 1%" }
  ],
  "replace_main_debit": true
}
```

Field reference:
- `account_code` *(required)* — must exist in `chart_of_accounts` with `allow_posting=true`.
- `side` *(required)* — `"debit" | "credit"`.
- `split` *(required)* — one of:
  - `{ "type": "percent", "value": <0..100> }` — % of `txn.amount` (net of ITBIS, same base the existing engine uses).
  - `{ "type": "fixed", "value": <number> }` — flat amount in transaction currency.
  - `{ "type": "remainder" }` — the leftover after all percent + fixed lines on the same side. At most one per side per rule.
- `cost_center` *(optional)* — overrides the transaction's cost center for description tagging only (the line itself stores no cost center; tag goes into the line description).
- `description` *(optional)* — line description; falls back to the rule name.
- `replace_main_debit` *(rule-level, optional, default `false`)* — when `true` and the rule provides ≥1 debit `extra_line`, the engine **suppresses** its default single debit-to-master line and uses only the `extra_lines` for the debit side. Same idea for `replace_main_credit` on the credit side. This is what enables the 70/30 split — without it you'd get *three* debit lines (the original + the two splits).

### Where lines are inserted in the existing journal flow

The existing engine builds a purchase journal as: `DR master`, `DR ITBIS pagado`, `CR withholdings`, `CR bank`. Phase 2 inserts `extra_lines` **after** the standard lines but **before** the bank-credit balancing line, then re-balances the bank-credit so the journal is still balanced.

Concretely, inside `generate-journals/index.ts`:
- Resolve all `extra_lines` → numeric amounts.
- If `replace_main_debit` and any debit extras exist → skip pushing the default `mainAccountId` debit line.
- If `replace_main_credit` → skip the default bank/AP/AR credit line; the extras must balance the debits themselves (validate this, see below).
- Otherwise: push extras as additional lines, and **subtract debit extras − credit extras** from the bank-credit balancing amount before it's written.

## Validation (must, in this exact order)

1. **Schema shape** — every line has `account_code`, `side`, `split`. Bad shape → skip the *extra_lines* (apply standard journal), log to `error_logs` with rule id.
2. **Account exists & postable** — unknown code → skip extras, log.
3. **Percent sums** — sum of `percent` lines per side ≤ 100. Over → skip extras, log.
4. **At most one `remainder` per side**.
5. **Max 10 extra lines per rule** — hard cap to prevent runaway journals.
6. **Final journal balance** — after all lines are computed, debits must equal credits within DOP 0.01. If not (e.g. `replace_main_credit` with bad math) → skip the entire journal, push to `skipped[]`, log.
7. **Replace flags require corresponding extras** — `replace_main_debit:true` with zero debit extras → ignore the flag (defensive).

When extras are skipped, the standard journal still posts. The accountant sees a warning in `error_logs` and can fix the rule.

## Manager UI — `PostingRulesManager.tsx`

Add a collapsible **"Líneas adicionales (avanzado)"** section under the existing Actions block. Inside:

- Two checkboxes: "Reemplazar débito principal" / "Reemplazar crédito principal" (only enabled when at least one debit/credit extra exists, respectively).
- A small editable table of extra lines with columns: **Cuenta** (account picker reusing `AccountSelector` pattern), **Lado** (Débito/Crédito), **Tipo** (Porcentaje/Monto fijo/Resto), **Valor** (number, hidden when type=Resto), **Descripción** (optional), **🗑**.
- "+ Agregar línea" button. Cap at 10 (button disables).
- Live validation banner: percent sum per side, remainder count, balance preview when `replace_main_*` is on.
- Help text under the section explaining the two replace flags in plain Spanish, plus a one-line example for each of the three use cases.

The existing `actionsSummary` chip on the rules list should append `+N líneas` when extras are present.

## Audit trail — `posting_rule_applications`

When a rule contributes extra lines, append `extra_lines: <count>` to the `applied_fields` JSONB so Phase 3's `JournalRuleBadge` automatically surfaces it. No code change needed in the badge — the existing iterator over `applied_fields` already handles arbitrary keys.

## Files

- `supabase/functions/generate-journals/index.ts` *(modify — fetch active rules, evaluate per txn, insert extras with validation + balance check)*
- `src/components/settings/PostingRulesManager.tsx` *(modify — extras editor + summary chip)*
- `src/lib/postingRules.ts` *(modify — extend `PostingRuleAction` interface with `extra_lines` + `replace_main_*` flags so the form is type-safe)*
- `src/i18n/es.ts`, `src/i18n/en.ts` *(modify — labels for the new section)*

## Validation steps

1. **70/30 fuel split** — create rule matching vendor "ISLA"/"SUNIX": `master=5110`, extras `[{5110,debit,70%,agricultural}, {5110,debit,30%,industrial}]`, `replace_main_debit=true`. Enter a fuel purchase. Generate journal → expect 2 debit lines (no third), credit bank, balanced.
2. **B11 1% ISR accrual** — rule matching `ncf_prefix=["B11"]`: extras `[{2170,credit,1%}]`, no replace flags. Enter a B11 invoice. Generate journal → standard purchase + extra `CR 2170` line. Bank credit reduced by 1%. Balanced.
3. **Bad rule (percent > 100)** — extras `[{x,debit,80%}, {y,debit,50%}]`. Save in manager → red inline warning. Force-save anyway → at journal generation, extras are skipped, standard journal posts, `error_logs` entry created.
4. **Phase 3 badge** — open the journal from step 1 → "Reglas 1" badge → popover lists the rule with `extra_lines: 2` in applied fields.
5. **No regression** — rules without `extra_lines` produce identical journals to today (byte-for-byte where possible).

## Limitations / explicitly out of scope

- **Multi-period amortization** (rent over 12 months) — requires period scheduling and reversing entries; deferred to Phase 2.5.
- **Conditional extras** ("split only if amount > X") — extras fire whenever the rule fires; condition logic stays at the rule level.
- **Cross-entity extras** (e.g., split between two entities) — extras post to the same entity as the source journal. Intercompany remains its own engine.
- Extras cannot reference accounts in a different currency from the journal. If the rule's account currency differs from `txn.currency`, the line is skipped + logged. (Matches existing FX behaviour.)
- The replace flags are deliberately per-side, not per-line, to keep the mental model simple.
