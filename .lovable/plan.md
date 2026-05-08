
# Home Office Loans (Casa Matriz) — final plan

## On the existing "Revaluar FX" button — there will be **one** FX, not two

The existing **`<FxRevaluationButton>`** (in the Accounting header) calls the RPC **`revalue_open_ap_ar`**. That RPC walks **only `ap_ar_documents`** in foreign currency with `status in ('open','partial')` and posts deltas to **8510 — Diferencia Cambiaria**, logging each delta in `ap_ar_fx_revaluations` (active/reversed model so it's idempotent across periods).

Account **2160 (Casa Matriz)** is **not** an AP/AR document — it's its own sub‑ledger — so today it is **not revalued by anyone**. There is no double counting risk and there is also a real gap.

Decision: **one FX engine, one button, one P&L account.**

- **Reuse the same button.** No second "Revaluar Casa Matriz" button. The existing one becomes the universal period‑end FX revaluation trigger.
- **Reuse account 8510** for both gains and losses (sign of the journal indicates direction — same convention `revalue_open_ap_ar` already uses). Drop the earlier 7710/4710 split idea.
- **Extend the engine, don't fork it.** Either:
  - **(a, preferred)** add a sibling RPC `revalue_open_home_office(p_date, p_period_id, p_user_id, p_entity_id)` that mirrors the AP/AR pattern (per‑tranche advance, reverse prior active reval, post delta vs 2160/2960 to 8510), and have `<FxRevaluationButton>` call **both** RPCs in sequence inside one user action. The preview dialog already shows "accounts to revalue" — we add Casa Matriz tranches to that count.
  - (b) add a wrapper RPC `revalue_all_fx(...)` that internally calls AP/AR + Casa Matriz; button calls only the wrapper. Cleaner long‑term but a bigger migration touch.
  - We'll go with **(a)** — least disruptive, identical UX.
- **`home_office_fx_revaluations`** mirrors `ap_ar_fx_revaluations` exactly: `(advance_id, period_id, journal_id, dop_delta, rate_used, is_active)`. Same "deactivate prior + post new" pattern, so re‑running for the same period replaces the prior reval rather than stacking.
- **Triggers extend the existing pattern.** When a `home_office_repayments` row settles a tranche to zero or an advance is voided, set `is_active = false` on its open reval rows — same shape as `deactivate_fx_revals_on_paid_void()`.
- **Cron** (last day of month) calls the same combined trigger via the existing pattern (one cron entry, both engines).

Net effect: one button, one P&L line (**8510**), one consistent reval audit trail spanning AP, AR, and Casa Matriz.

---

## Decisions locked in

- **Loan currency:** **USD** today, switchable to **SEK** later (`home_office_parties.currency` editable; new advances use the new currency, history stays at original).
- **Repayments:** sporadic, deferred. Repago lives behind a secondary "Acciones" menu, not a primary CTA.
- **Unpaid interest:** accrues monthly into **2960** and stays until JORD AB instructs to capitalize (rolled into 2160) or to be paid.
- **Capitalize CIP:** Accountant role sufficient.
- **FX gain/loss:** unified with existing AP/AR engine, posted to **8510**, logged in `home_office_fx_revaluations`, reused button.

---

## Module scope

### Data model

- `home_office_parties` — registry of external parents (seed: "JORD AB", currency `USD`). Fields: name, tax_id, currency, `interest_rate_pct`, `interest_basis` (`actual/360` | `actual/365` | `30/360` | `none`), `compounding` (default `simple`), `accrual_account` (2960), `expense_account` (8460), `liability_account` (2160).
- `home_office_advances` — per inflow event: `kind` (`cash_transfer` | `equipment_capitalize` | `equipment_cip` | `equipment_inventory` | `expense_paid_on_behalf` | `other`), `party_id`, `entity_id`, `advance_date`, `currency`, `amount_fc`, `fx_rate`, `amount_dop`, `balance_remaining_fc`, `reference`, `description`, `status`, `journal_id`, `transaction_id` / `fixed_asset_id` / `cip_project_id`.
- `home_office_repayments` — outflows: cash, offset, write‑off; stores realized FX (also posted to 8510).
- `home_office_interest_accruals` — `period_month`, `avg_daily_balance_fc`, `avg_daily_balance_dop`, `rate_pct`, `days`, `interest_fc`, `interest_dop`, `journal_id`, `status` (`accrued` | `capitalized` | `paid`).
- `home_office_fx_revaluations` — mirror of `ap_ar_fx_revaluations`: `(advance_id, period_id, journal_id, dop_delta, rate_used, is_active)`.
- `cip_projects` — `name`, `cip_account_code` (1080/1180/1280), `entity_id`, `status`, `placed_in_service_date`, `final_asset_id`.
- `home_office_balance` view — per party / per tranche, principal vs interest, FC + DOP at original/today rates.

### Posting rules

| Event | Dr | Cr |
|---|---|---|
| Cash wire received | Bank (1110.x) | **2160** |
| Equipment → capitalized directly | 14xx (+ ITBIS) | **2160** |
| Equipment → CIP | **1080 / 1180 / 1280** | **2160** |
| Equipment → inventory | Inventory | **2160** |
| Expense paid on our behalf | Expense + cost center | **2160** |
| Monthly interest accrual | **8460** | **2960** |
| Interest capitalized into principal (Accountant OK) | **2960** | **2160** |
| Interest paid in cash | **2960** | Bank |
| CIP placed in service (Accountant OK) | 14xx | 1080/1180/1280 |
| Cash repayment + realized FX | **2160** + **8510** | Bank |
| Period‑end FX reval — loss | **8510** | **2160** / **2960** |
| Period‑end FX reval — gain | **2160** / **2960** | **8510** |

All journals route through `post_journal`, inherit period‑lock, audit log, approval thresholds, drill‑down chain (`source_type` ∈ `home_office_advance`, `home_office_repayment`, `home_office_interest_accrual`, `home_office_fx_reval`, `cip_capitalize`).

### UX

New tab **Accounting → Casa Matriz**:

- **Saldo Casa Matriz** card: per party, principal + accrued interest, FC and DOP at original and today's rate, unrealized FX delta highlighted (informational; the actual posting happens through the shared "Revaluar FX" button).
- **Nueva entrada** dialog with `kind` selector. *Equipment with invoice* opens sub‑selector — *Capitalize directly* / *Construction in progress* / *Inventory*. CIP path picks/creates a `cip_projects` row + CIP account.
- **Movimientos** table with drill‑down badges to journal/transaction/asset/CIP/repayment/accrual/reval.
- **Acciones** menu (secondary): Repago, Capitalizar interés, Pagar interés.
- **Reconciliación**: attach JORD AB statement PDF and tick‑off matched lines (no auto‑match v1).

**Header `<FxRevaluationButton>`** is unchanged in placement, but its preview dialog and confirm action now cover AP + AR + Casa Matriz tranches.

New section **Accounting → CIP** (tab inside Fixed Assets):

- Open CIP projects with running balance per CIP account.
- **Capitalize CIP** action (Accountant OK): pick project, placed‑in‑service date, useful life → creates `fixed_assets` row, posts `Dr 14xx / Cr 1080|1180|1280`, depreciation begins.

### Interest engine

- Monthly cron (last day of month, runs **before** FX reval) computes per party `interest = avg_daily_balance × rate × days / basis`, posts `Dr 8460 / Cr 2960`, inserts `home_office_interest_accruals`.
- `interest_basis = 'none'` skips that party.
- "Capitalizar interés" button posts `Dr 2960 / Cr 2160`, marks accrual `capitalized`.
- "Pagar interés" posts `Dr 2960 / Cr Bank`, marks accrual `paid`.

### FX engine (unified)

- Same monthly cron then calls **both** `revalue_open_ap_ar` and the new `revalue_open_home_office` for every entity. Manual user trigger: existing `<FxRevaluationButton>` does the same two‑call sequence.
- Idempotent: prior active reval row is deactivated and reversed before posting the new one (same pattern as today).
- Single P&L account: **8510**.

### Reports

- **Estado de Casa Matriz** (range‑filtered): opening, additions by kind, interest accrued, interest capitalized/paid, repayments, FX reval (8510), closing — split principal vs interest. Export PDF/Excel.
- Balance Sheet and P&L unchanged (already pick up 2160, 2960, 1180/1280/1080, 8510, 8460).

### Permissions

- Admin / Mgmt / Accountant: full CRUD, including capitalize CIP, capitalize interest, run revaluation.
- Supervisor / Viewer: read‑only.
- Driver: no access.
- Period locks and approval thresholds enforced.

## Out of scope for v1

- Auto‑matching JORD AB statement lines.
- Promoting JORD AB to a real `entity` and using sibling intercompany flow.
- Compounding more granular than monthly.
- Per‑asset FX revaluation (assets stay at historical DOP cost; only the liability and accrued interest are revalued).

## Files (build phase)

- **Migrations**: tables + view + RPCs `post_home_office_advance`, `post_home_office_repayment`, `post_home_office_interest_accrual`, `revalue_open_home_office` (mirrors `revalue_open_ap_ar`), `capitalize_cip_project`, `capitalize_interest_to_principal`; trigger `deactivate_ho_fx_revals_on_settle_or_void`; `drilldown_resolve` route additions; RLS; seed JORD AB row.
- **Edge functions**: `home-office-interest-cron`, plus extending the FX cron entry to call both reval RPCs.
- **New components**:
  - `src/pages/CasaMatriz.tsx` (new tab inside `Accounting.tsx`)
  - `HomeOfficeAdvanceDialog.tsx` (with destination‑type sub‑selector)
  - `HomeOfficeRepaymentDialog.tsx`
  - `HomeOfficeBalanceCard.tsx` (FC + DOP + unrealized FX preview)
  - `HomeOfficeMovementsTable.tsx`
  - `HomeOfficeInterestPanel.tsx`
  - `CipProjectsView.tsx` + `CapitalizeCipDialog.tsx`
  - `CasaMatrizStatementReport.tsx`
- **Edits**:
  - `FxRevaluationButton.tsx` — extend preview + confirm to include Casa Matriz tranches; call new RPC after AP/AR.
  - `TransactionForm.tsx` — `pay_method = 'home_office:<party_id>'` virtual method.
  - `Accounting.tsx` — add Casa Matriz tab; CIP tab inside Fixed Assets view.
  - `FixedAssetsView.tsx` — "from CIP" badge for assets capitalized from CIP.
  - i18n es/en strings.
