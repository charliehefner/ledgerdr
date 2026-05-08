# Lovable Plan — current focus

## ✅ #7 — Flexible Accounting Dimensions (Part A)
- Schema: `accounting_dimensions`, `accounting_dimension_values`, `account_dimension_rules`, `journal_line_dimensions`.
- Seeded `cost_center` dimension (general / agricultural / industrial); backfilled tags from `transactions.cost_center`.
- `validate_journal_line_dimensions(journal_id)` returns missing-required gaps (warn-only this release).
- New Settings tab **"Dimensiones"** with `DimensionsManager` (CRUD on dimensions + their values).
- Per-line tagging UI in TransactionForm and dimension-filtered reports remain as a follow-up — schema and admin layer ready first.

## ✅ #9 — Universal Drill-Down Audit Chain (Part B)
- Schema: polymorphic `journal_source_links` (10 source types) + immutability trigger after journal post.
- Auto-link trigger on `journals` keeps links in sync whenever `transaction_source_id` is set; reversal journals copy parent links automatically.
- Backfilled all historical journals from `transaction_source_id`.
- `drilldown_resolve(journal_id)` RPC returns deep-link routes per source.
- `<DrilldownBadges>` component renders source badges; integrated into `JournalDetailDialog` header — every existing call site that opens a journal now shows the source chain.

## Follow-ups (deferred)
- Wire dimension picker into `TransactionForm` / `EditTransactionDialog` (replacing single cost-center dropdown).
- Switch `validate_journal_line_dimensions` from warn-only to enforce mode (block posting).
- Dimension filter sidebar on P&L / Balance Sheet / Trial Balance.
- `DimensionPivotReport` component.
- Backfill source links for payroll, depreciation, GR sources beyond `transaction`.
