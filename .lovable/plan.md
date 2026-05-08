## Two-Part Plan: Flexible Dimensions (#7) + Drill-Down Audit Chain (#9)

Both touch `journal_lines` and reporting layers, so they ship as one coordinated effort to avoid double-touching the same files.

---

## Part A — Flexible Accounting Dimensions

Today: cost centers are a hardcoded enum (General / Agrícola / Industrial). `journal_lines` already has free-form `project_code` and `cbs_code` text fields but they aren't structured, validated, or reportable.

Goal: replace the hardcoded enum with a **dimension framework** that supports the existing three centers (as the first dimension, "Cost Center") plus user-defined dimensions (e.g. Project, Field/Lot, Crop Cycle, Funding Source) without adding columns each time.

### Data Model

**`accounting_dimensions`** (the dimension definition)
- `entity_id` (NULL = global), `code` (e.g. `cost_center`, `project`, `field`), `name_es`, `name_en`
- `is_required_default` (boolean — whether new accounts inherit a "must fill" flag)
- `display_order`, `active`

**`accounting_dimension_values`** (the allowed values per dimension)
- `dimension_id`, `entity_id`, `code`, `name_es`, `name_en`, `parent_value_id` (hierarchy), `active`

**`account_dimension_rules`** (per-account requirement overrides)
- `account_id`, `dimension_id`, `requirement` (`required` | `optional` | `blocked`)

**`journal_line_dimensions`** (the actual tagging — sparse table, no schema churn when new dimensions are added)
- `journal_line_id`, `dimension_id`, `dimension_value_id`
- UNIQUE (`journal_line_id`, `dimension_id`)

### Migration of existing data
- Seed dimension `cost_center` with values `general`, `agricola`, `industrial` (+ any others currently in use).
- Backfill `journal_line_dimensions` from the existing `category` / cost-center column wherever found.
- Keep the legacy column readable for one release, mark deprecated, then drop.

### Posting & Validation

- New trigger `enforce_journal_line_dimensions` on `journals` posting: for each line, look up the account's required dimensions (default + overrides) and raise if any required dimension is missing.
- Update `create_journal` / `post_journal` RPCs to accept a `p_dimensions jsonb` array per line: `[{dimension_code, value_code}, ...]`.
- Update `TransactionForm` + `EditTransactionDialog`: replace the single Cost Center dropdown with a dynamic block that renders one dropdown per active dimension, marked required where applicable.
- Existing posting rules (`postingRules.ts`) get extended so default dimensions can be inferred (e.g. fuel purchases → `cost_center=industrial`).

### Reporting

- P&L, Balance Sheet, GL drill-down: add a multi-select **Dimension filter** sidebar (filter rows where `journal_line_dimensions` matches selected values).
- New report: **Dimension Pivot** — pick rows = accounts, columns = values of one dimension, measure = posted balance for the date range.
- PowerBI export adds the dimension columns.

### Out of Scope
- Cross-dimension validation rules (e.g. "Project X only valid with Cost Center Y").
- Allocation engine (split one line across % of dimensions). Future phase.

---

## Part B — Universal Drill-Down Audit Chain

Today: most source documents (transactions, payroll, depreciation) link to journals via `journals.transaction_source_id`, but the link is ad-hoc and not every report exposes a click-through. Some sources (operations, fuel, GR) post via different paths and are harder to trace.

Goal: every numeric value shown on a financial report can be traced **GL line → journal → source document → original entry screen** in one click, with an immutable proof of origin.

### Data Model

**`journal_source_links`** (replaces single `transaction_source_id` with a polymorphic, multi-source link table)
- `journal_id`, `source_type` (`transaction` | `payroll_run` | `depreciation_run` | `fixed_asset` | `goods_receipt` | `purchase_order` | `bank_recon_match` | `recurring_template` | `accrual` | `manual`)
- `source_id` (uuid of the source row), `source_label` (denormalized human-readable: "FAC-001234", "Payroll Apr-2026", etc.)
- `created_at`
- INDEX on (`source_type`, `source_id`) and on `journal_id`

Backfill: one-time migration walks every existing journal with non-null `transaction_source_id` and writes a `transaction` link, then walks payroll runs, depreciation runs, etc. by their existing FK columns.

### Drill-Down Service

**`drilldown_resolve(p_journal_id)` RPC** — returns all source link rows + a canonical front-end route per `source_type` (table maintained server-side):

```text
transaction       → /transactions?id={source_id}
payroll_run       → /hr/payroll/{source_id}
depreciation_run  → /accounting/fixed-assets/depreciation/{source_id}
goods_receipt     → /purchasing?gr={source_id}
purchase_order    → /purchasing?po={source_id}
bank_recon_match  → /accounting/bank-recon/{source_id}
accrual           → /accounting/accruals/{source_id}
recurring_template→ /accounting/recurring/{source_id}
manual            → /accounting/journals/{journal_id}
```

### UI Pattern: `<DrilldownCell>`

A reusable cell that takes a `journal_line_id` (or a list of them, for aggregated report cells) and renders:
- Click → opens a slide-over showing journal header + all lines + source link badges.
- Each badge is a deep-link to the source screen, which already supports highlight-on-load via `?id=...&hl=1`.

Wired into:
- **General Ledger** — every row already has `journal_id`; just swap the existing modal for the new component.
- **Trial Balance** — each account row → list of journal lines for the period.
- **P&L / Balance Sheet** — each amount cell → "Show contributing journals" slide-over (uses the same query that builds the cell, passes `account_id`, `period`, dimension filters).
- **Cash Flow Statement** (if/when added) — same pattern.
- **AP/AR aging** — drill from outstanding balance to the document, then from document to its posting journal.
- **Bank Reconciliation** — drill from matched line to journal that posted it.

### Immutability Guarantees

- `journal_source_links` is INSERT-only after journal posts (trigger blocks UPDATE/DELETE on links of posted journals).
- Posted journals already cannot be edited (existing rule); add a constraint that even reversals must reference the original via `reversal_of_id` AND copy its source links to the reversal journal so the audit chain survives.
- Source documents already have `posted` / `voided` states — drill-down displays the state badge so an auditor immediately sees if the underlying doc was reversed.

### Reporting Layer

- All financial-report queries return `journal_line_id`s alongside aggregated amounts (or, for grouped cells, an array of contributing line IDs).
- Existing CSV/PDF exports get an optional "with journal references" toggle that appends a JE# column.

### Out of Scope
- Full external audit-firm export pack (SOC-1 style).
- Time-travel ("show this report as it would have looked before reversal X"). Future phase.

---

## Files

**Created (Part A)**
- `supabase/migrations/<ts>_accounting_dimensions.sql` — tables, RLS, validation trigger, RPC updates.
- `src/components/accounting/DimensionsManager.tsx` — admin CRUD for dimensions + values.
- `src/components/transactions/DimensionTagger.tsx` — reusable per-line tag block.
- `src/components/accounting/DimensionPivotReport.tsx`.
- `src/lib/dimensions.ts` — typed client helpers.

**Created (Part B)**
- `supabase/migrations/<ts>_journal_source_links.sql` — table, backfill, immutability trigger, `drilldown_resolve` RPC.
- `src/components/accounting/DrilldownCell.tsx` + `DrilldownSlideOver.tsx`.
- `src/lib/drilldown.ts` — route resolver + hook.

**Modified**
- `src/components/transactions/TransactionForm.tsx`, `EditTransactionDialog.tsx` — swap cost-center dropdown for `<DimensionTagger>`.
- `src/components/accounting/{ProfitLossView,BalanceSheetView,AccountingReportsView,GeneralLedgerView}.tsx` — dimension filter + drill-down cells.
- `src/components/settings/PostingRulesManager.tsx` — default-dimension inference rules.
- `src/lib/postingRules.ts`, `src/lib/api.ts` — new dimension payloads on every posting call site.
- `.lovable/plan.md` — track #7 + #9.

## Acceptance

**Part A**
- Admin can create a new dimension "Project" with values, mark it required for account 6010.
- Posting a journal that touches 6010 without a Project value fails with a clear error.
- P&L can be filtered by `cost_center=agricola AND project=P-2026-01`.
- Existing three cost centers continue to work unchanged after migration.

**Part B**
- From P&L cell "Diesel - Industrial: 245,000" → click → see 12 contributing journals → click any → see all lines → click "FAC-001234" badge → land on the original AP invoice screen with that invoice highlighted.
- Reversing a posted journal copies the source links to the reversal journal; both appear in the drill-down with state badges.
- Attempting to UPDATE/DELETE a `journal_source_links` row whose journal is posted raises an error.

## Sequencing

1. Ship Part B first (lower risk, additive). Backfill runs once, all reports keep working.
2. Then Part A (touches every posting path; needs the dimension UI built before flipping the validation trigger to enforce mode — ship in `warn` mode for one release, then `enforce`).
