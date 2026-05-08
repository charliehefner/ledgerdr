# Wire-up plan: Drilldown + Dimensions

Make both new features fully functional without disturbing existing posting/reporting paths.

## Part 1 — Drill-down deep links work end to end

Goal: clicking a `<DrilldownBadges>` badge opens the actual source record.

1. **Transactions deep link** (`/transactions?id=<uuid>`)
   - `Transactions.tsx`: read `?id=` via `useSearchParams`, pass `openTransactionId` prop to `RecentTransactions`.
   - `RecentTransactions.tsx`: on mount/prop change, fetch the single tx by id (if not in current page) and open `EditTransactionDialog` with it; clear the param after opening.

2. **Fixed asset / depreciation deep link**
   - Update `drilldown_resolve` routes to:
     - `fixed_asset`         → `/accounting?tab=fixed-assets&asset=<id>`
     - `depreciation_entry`  → `/accounting?tab=fixed-assets&dep=<id>`
   - `Accounting.tsx`: already tabs-based; read `?tab=` and forward `?asset=`/`?dep=` into `FixedAssetsView` to highlight the row.

3. **Purchasing deep link** (`/purchasing?po=` / `?gr=`)
   - `Purchasing.tsx`: read params, scroll to / highlight the matching PO or GR card. No-op gracefully if id not found.

4. **Routes still incomplete** (`bank_recon_match`, `recurring_template`, `accrual`, `manual`)
   - Keep current routes; badges stay clickable — landing pages already exist (manual → `/accounting/journals/<id>` becomes `/accounting?tab=ledger&jid=<id>`). Mark accrual / recurring as no-link for now (badge renders without link until those modules exist).

## Part 2 — Per-line dimension picker on journals

5. **`<DimensionPicker>`** new component in `src/components/accounting/`:
   - Loads active `accounting_dimensions` + their values via React Query.
   - Renders one inline `<Select>` per active dimension.
   - Emits `{ dimension_id → dimension_value_id | null }`.

6. **`JournalDetailDialog`** lines table:
   - Add one column per active dimension (between Description and Project).
   - Load existing tags via `journal_line_dimensions` (joined in the journal query).
   - On Save: diff current tags vs existing → upsert/delete in `journal_line_dimensions`. Skip when journal posted.

7. **Auto-sync from `transactions.cost_center`** (no UI change to `TransactionForm`):
   - Extend `fn_journal_autolink_sources` trigger: when a journal is inserted with `transaction_source_id`, look up the source transaction's `cost_center` and insert matching `journal_line_dimensions` rows for each new line. Idempotent (`ON CONFLICT DO NOTHING`).
   - This means every new posting from `TransactionForm` produces dimension tags automatically — no double-entry by the user.

## Part 3 — Account dimension rules admin UI

8. **New `<AccountDimensionRulesPanel>`** added as a third card inside `DimensionsManager`:
   - Pick an account from a searchable combobox over `chart_of_accounts` (posting-allowed only).
   - For each active dimension, dropdown: `optional` / `required` / `blocked`.
   - CRUD against `account_dimension_rules`.

## Part 4 — Warn-mode validation hook

9. **Wrap `post_journal` invocation client-side**:
   - In `JournalDetailDialog.handlePost` and `TransactionForm` post flow, after a successful `post_journal`, call `validate_journal_line_dimensions(journal_id)` (read-only; returns missing required tags).
   - If rows returned → non-blocking warning toast listing affected accounts. Posting still succeeds (warn-only release).
   - This satisfies the "validation has effect" gap without risking blocked operations.

## Part 5 — Dimension filter (reports)

10. **Keep existing cost-center filter intact.** Add a dynamic dimension filter ONLY for new dimensions:
    - Tiny `<DimensionFilters>` toolbar component on `AccountingReportsView` that lists active dimensions besides `cost_center`.
    - Filter post-fetch in JS by joining loaded `journal_line_dimensions` (the volume on these report pages already supports client filtering — no RPC change needed for v1).
    - P&L / Balance Sheet keep their current `p_cost_center` flow unchanged (touched only if user later asks).

## Files

**Created**
- `src/components/accounting/DimensionPicker.tsx`
- `src/components/settings/AccountDimensionRulesPanel.tsx`
- `src/components/accounting/DimensionFilters.tsx`
- `supabase/migrations/<ts>_drilldown_routes_and_dim_autosync.sql`

**Modified**
- `src/pages/Transactions.tsx`, `src/components/transactions/RecentTransactions.tsx`
- `src/pages/Accounting.tsx`, `src/components/equipment/FixedAssetsView.tsx`
- `src/pages/Purchasing.tsx`
- `src/components/accounting/JournalDetailDialog.tsx`
- `src/components/transactions/TransactionForm.tsx` (post-call validation hook only)
- `src/components/settings/DimensionsManager.tsx`
- `src/components/accounting/AccountingReportsView.tsx`
- `src/lib/drilldown.ts` (no logic change; types only if new badges added)

## Out of scope (intentional, can be follow-ups)

- True server-side dimension filter on `compute_pnl` / `compute_balance_sheet` RPCs.
- Hard-enforce mode for `validate_journal_line_dimensions`.
- Drill-down badges in P&L / BS / GL cells (current scope: the journal detail dialog is the entry point).
- Recurring journals / accruals modules (routes will remain as link-less badges).

## Risk

Additive only. No existing RPC signatures change. The trigger extension is idempotent and only writes tags when matching dimension values exist (no failure path if `cost_center` dimension is later renamed). Warn-only validation never blocks posting.
