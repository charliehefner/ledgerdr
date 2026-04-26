# Part B — Reversing Accruals (Manual on Journal View)

Using **2180 "Acumulaciones por Pagar"** as the liability account (new code, added to chart). Implementation strategy: insert directly into `journals` + `journal_lines` tables (since accruals have no source transaction), with rollback on failure.

## 1. Database migration

**Add account 2180 to chart of accounts** (idempotent insert across all entities):
- Code: `2180`
- Name ES: `Acumulaciones por Pagar` / EN: `Accrued Liabilities`
- Type: liability, `allow_journal_entries = true`
- Parent: appropriate liability parent (e.g., 2100 Cuentas por Pagar group, verified at migration time)

**New table `accrual_entries`:**
- `id uuid PK`
- `entity_id uuid NOT NULL`
- `accrual_date date NOT NULL`
- `reversal_date date NOT NULL`
- `expense_account_id uuid NOT NULL` (FK chart_of_accounts)
- `liability_account_id uuid NOT NULL` (FK chart_of_accounts, defaults to 2180)
- `amount numeric(14,2) NOT NULL CHECK (amount > 0)`
- `currency text NOT NULL DEFAULT 'DOP'`
- `cost_center text`
- `description text NOT NULL`
- `reference text` (vendor / counterparty)
- `accrual_journal_id uuid` (FK journals)
- `reversal_journal_id uuid` (FK journals)
- `status text NOT NULL DEFAULT 'scheduled'` CHECK in (`scheduled`,`reversed`,`cancelled`)
- Audit: `created_at`, `created_by`, `updated_at`

**RLS on `accrual_entries`:**
- SELECT: admin, accountant, management, supervisor (entity-scoped via existing helper)
- INSERT/UPDATE: admin + accountant only
- DELETE: blocked (use status=`cancelled` instead)

**Trigger** `trg_flip_accrual_status_on_post`: when `journals.status` flips to posted on a journal id referenced as `reversal_journal_id`, update matching `accrual_entries.status` from `scheduled` → `reversed`.

## 2. Edge function `post-accrual` (new)

`supabase/functions/post-accrual/index.ts` — single function handling both legs.

**Flow:**
1. Validate JWT via `getClaims()`. Resolve user + role. Reject if not admin/accountant.
2. Zod-validate body: `entity_id`, `accrual_date`, `expense_account_id`, `liability_account_id` (default to 2180 lookup), `amount > 0`, `currency`, `description`, `reference`, `cost_center?`.
3. Fetch both accounts: must exist, belong to entity (or global), `allow_journal_entries = true`, expense ≠ liability.
4. Verify `accrual_date` falls in an OPEN `accounting_periods` row for the entity. Reject if closed/locked.
5. Compute `reversal_date`: query `accounting_periods` for the next period (start_date > accrual period end), pick the earliest with `status='open'`. If none → 400 with clear message ("No hay un período abierto futuro para programar el reverso").
6. Insert accrual journal (`journal_type='GJ'`, date=accrual_date, description=`Acumulación: <reference> — <description>`, currency, entity_id, status=posted) + 2 journal_lines (DR expense, CR liability).
7. Insert reversal journal (date=reversal_date, description=`Reverso de acumulación: <reference> — <description>`, status=posted) + 2 journal_lines (DR liability, CR expense).
8. Insert `accrual_entries` row with both journal IDs, status=`scheduled`.
9. On any failure after journal creation: void inserted journals (set status='void' + null lines or call existing void path) and return 500. Log to `app_error_log`.
10. Return `{ accrual_journal_id, reversal_journal_id, reversal_date, accrual_entry_id }`.

## 3. UI

**`src/components/accounting/AccrualEntryDialog.tsx`** (new):
- Fields: Reference (text), Description (text), Amount (numeric), Currency (DOP/USD/EUR, default DOP), Accrual date (DatePicker, default today), Expense account selector (filtered: `allow_journal_entries=true`, expense class), Liability account selector (default 2180, filtered to liabilities, editable), Cost center.
- Live preview block: shows the two computed journals side-by-side with accounts, amounts, and the auto-derived reversal date. Reversal date is fetched via a lightweight RPC or direct `accounting_periods` query.
- Submit calls `supabase.functions.invoke('post-accrual', ...)`. On success, toast + close + refresh parent.

**`src/components/accounting/AccrualsList.tsx`** (new):
- Table: Reference, Accrual date, Reversal date, Expense account, Amount, Status badge, links to both journal IDs.
- Action menu per row:
  - **Cancelar** — visible only when status=`scheduled` AND reversal period still open. Voids both journals + sets status=`cancelled` (via small RPC or direct updates wrapped server-side).
  - **Ver journal** (jumps to JournalDetailDialog).

**`src/components/accounting/JournalView.tsx`** (edit):
- Add **"Crear acumulación"** button in toolbar, visible to admin + accountant, opens `AccrualEntryDialog`.
- Add a sub-tab **"Acumulaciones"** rendering `AccrualsList`.

## 4. i18n

Add to `src/i18n/es.ts` + `src/i18n/en.ts`:
- `accounting.accrual.create` — "Crear acumulación" / "Create accrual"
- `accounting.accrual.title`, `.reference`, `.description`, `.amount`, `.expenseAccount`, `.liabilityAccount`, `.accrualDate`, `.reversalDate`
- `accounting.accrual.preview` — "Vista previa de asientos" / "Journal preview"
- `accounting.accrual.reversalScheduled` — "Reverso programado para {date}" / "Reversal scheduled for {date}"
- `accounting.accrual.status.scheduled|reversed|cancelled`
- `accounting.accrual.cancel`, `.cancelConfirm`
- Error strings for closed periods, no future open period, invalid accounts.

## 5. Memory updates

- `mem://technical/accounting/hardcoded-account-dependencies` — add `2180` (Acumulaciones por Pagar — used by reversing accruals workflow).
- `mem://features/accounting/journal-management-system` — add accruals workflow note: manual creation via JournalView, dual-journal pattern (accrual posted in current period + reversal posted on first day of next open period), tracked in `accrual_entries`.

## Files

**New:**
- Migration: `accrual_entries` table + RLS + trigger + 2180 chart insert
- `supabase/functions/post-accrual/index.ts`
- `src/components/accounting/AccrualEntryDialog.tsx`
- `src/components/accounting/AccrualsList.tsx`

**Edited:**
- `src/components/accounting/JournalView.tsx`
- `src/i18n/es.ts`, `src/i18n/en.ts`

## Out of scope
- Auto-accrual posting rules (manual-only per earlier decision)
- Recurring monthly accruals (could reuse `recurring_entries` later)
- Bulk CSV accrual import
