# Plan — Accountant access to Posting Rules + Reversing Accruals

## Part A — Accountant access to "Reglas Contab."

**Problem:** The Posting Rules tab is gated by `canModifySettings` (admin-only). Accountants own GL postings and need to maintain rules.

**Change:** Introduce a new permission gate `canModifyPostingRules = role in {"admin", "accountant"}` and use it for:
- The `posting-rules` `TabsTrigger` and `TabsContent` in `src/pages/Settings.tsx` (replace the `canModifySettings` gate around line 138–143 and 370–373).
- The save/delete buttons inside `PostingRulesManager.tsx` (verify and unlock for accountants).

**Files:**
- `src/contexts/AuthContext.tsx` — add `canModifyPostingRules` to context value (also expose `canModifyChartOfAccounts` if we want symmetry; out of scope unless you want it).
- `src/pages/Settings.tsx` — swap the gate on the Reglas Contab. tab only.
- `src/components/settings/PostingRulesManager.tsx` — replace any internal `canModifySettings` checks with the new flag.

**RLS note:** `posting_rules` and `posting_rule_applications` policies must already allow accountants to write. I'll verify with a quick read of pg_policies before coding; if they're admin-only, I'll add a migration extending INSERT/UPDATE/DELETE to `accountant`.

---

## Part B — Reversing Accruals (manual, on Journal view)

**Why this is separate from amortization:** Phase 2.5's prepaid-asset model is self-clearing and needs no reversal. Reversing accruals solve the *opposite* case — recognizing an expense **before** the invoice arrives (utilities, payroll, interest, late professional fees) and auto-cancelling on day 1 of the next period so the real invoice posts cleanly.

### B.1 Database

New migration:
- Table `accrual_entries`:
  - `id uuid PK`, `entity_id uuid NOT NULL`
  - `accrual_date date` (the accrual itself, usually period-end)
  - `reversal_date date` (computed as 1st day of next open period at creation time)
  - `expense_account_id uuid` (debit side of accrual)
  - `liability_account_id uuid` (credit side of accrual; defaults to **2150 Accrued Liabilities**)
  - `amount numeric`, `currency text`, `cost_center text`
  - `description text`, `reference text` (e.g. vendor)
  - `accrual_journal_id uuid NULL` → set when accrual journal is created
  - `reversal_journal_id uuid NULL` → set when reversal journal is created
  - `status text` check in (`scheduled`,`reversed`,`cancelled`)
  - Standard `created_at/by` audit columns
- RLS: SELECT for accountant/admin/management/supervisor in entity; INSERT/UPDATE for admin + accountant.
- Hardcoded account map: ensure `2150` exists in master chart; add it if missing (memory file `hardcoded-account-dependencies` will be updated).

### B.2 Edge function: `post-accrual` (new)

Single edge function handling both posting steps so journal creation, account validation, and period-lock checks live server-side:

1. **Auth:** validate JWT, resolve user.
2. **Validate inputs** (Zod): amount > 0, accounts exist + `allow_journal_entries`, accrual_date in an OPEN period, expense ≠ liability account.
3. **Compute `reversal_date`:** first day of the next open period after `accrual_date` (skip closed/locked). If no open future period exists → 400.
4. **Create accrual journal** (`GJ`, dated `accrual_date`, description `"Acumulación: <reference>"`):
   - DR Expense / CR Liability for `amount` (cost-center label appended).
5. **Create reversal journal** (`GJ`, dated `reversal_date`, description `"Reverso de acumulación: <reference>"`):
   - DR Liability / CR Expense for the same `amount`.
6. Insert `accrual_entries` row with both journal IDs and status `scheduled`. (Both journals exist immediately — no scheduler needed. The reversal lives in the next open period and can be voided by the accountant if the real invoice doesn't show up.)
7. Wrap in single try/catch; on failure roll back created journals via `void_journal` and surface the error.

This mirrors the existing `generate-journals` patterns (period-lock pre-check, account validation, error logging to `app_error_log`).

### B.3 UI — Journal view

In `src/components/accounting/JournalView.tsx`:
- New toolbar button **"Crear acumulación"** (visible to admin + accountant).
- Opens new dialog `AccrualEntryDialog.tsx`:
  - Fields: Reference / vendor (free text), Description, Amount, Currency (default DOP), Accrual date (DatePicker, defaults to today; warns if not period-end), Expense account selector (filtered to `allow_journal_entries=true`, expense-class), Liability account selector (defaults to 2150, filtered to liabilities), Cost center.
  - Live preview block showing both journals side-by-side: "Acumulación 30 NOV 2026" + "Reverso 01 DIC 2026" (computed from open periods via a small RPC or query).
  - Submit → calls `post-accrual` → on success, refresh JournalView and toast "Acumulación creada y reverso programado para DD MMM YYYY".
- New tab/sub-section on the existing Journal view: **"Acumulaciones"** — table of `accrual_entries` showing reference, accrual date, reversal date, amount, status, links to both journal IDs, and an action menu:
  - **Cancelar** (only if status=`scheduled` AND reversal period still open) → voids both journals + sets status `cancelled`.
  - **Marcar como reversado** auto-fires when the reversal_journal posts (we already have it; status flips to `reversed` via a small DB trigger when `reversal_journal_id` belongs to a posted journal — or do it as part of the period-close routine).

### B.4 Audit & i18n

- Log to `app_error_log` on failures, no user-facing crashes.
- Add Spanish + English strings: `accounting.accrual.create`, `accounting.accrual.reference`, `accounting.accrual.reversalScheduled`, etc.
- Update memory: `mem://features/accounting/journal-management-system` to mention accrual workflow + the new 2150 hardcoded dependency.

---

## Files touched

**Part A (small):**
- `src/contexts/AuthContext.tsx`
- `src/pages/Settings.tsx`
- `src/components/settings/PostingRulesManager.tsx`
- (possible) one migration to extend RLS on `posting_rules*`

**Part B (new + edits):**
- New migration: `accrual_entries` table + RLS + (optional) trigger to flip status.
- New edge function: `supabase/functions/post-accrual/index.ts` (registered with `verify_jwt = false` + in-code JWT validation, matching project conventions).
- New component: `src/components/accounting/AccrualEntryDialog.tsx`.
- New component: `src/components/accounting/AccrualsList.tsx` (or inlined as a tab on JournalView).
- Edits: `src/components/accounting/JournalView.tsx`, `src/i18n/es.ts`, `src/i18n/en.ts`.
- Memory updates: hardcoded accounts (2150), journal-management-system.

## Out of scope (call out so we agree)
- **Auto-accruing rules** (you chose manual-only). Easy to layer on later as an `accrue:` posting-rule action.
- **Bulk period-end accrual import** from a CSV / template.
- **Recurring accruals** (e.g., monthly utilities at month-end). Could be added via the existing `recurring_entries` infra in a follow-up.
