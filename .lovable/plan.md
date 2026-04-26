# Plan: New "Office" Role

## Scope
Create a new `office` role with the access matrix you specified, plugged into the existing approval engine. Office can write petty cash in Treasury; the rest of Treasury stays read-only.

## 1. Database migration
- Extend the `app_role` enum with `'office'`.
- RLS additions:
  - `transactions`: office can `INSERT` her own rows; can `UPDATE`/`DELETE` her own rows only while `approval_status = 'pending'`.
  - `petty_cash_transactions` (and related petty cash tables): office can `INSERT`/`UPDATE`/`DELETE` within her entity scope.
  - All other Treasury tables (`bank_accounts`, `bank_movements`, `credit_cards`, `credit_card_transactions`, `bank_reconciliation*`): read-only for office.
  - Read-only SELECT policies for office on: `journals`, `journal_lines`, `chart_of_accounts`, `ap_ar_documents`, `treasury` views.
- No changes to `approval_policies` or `trg_check_transaction_approval` — office inherits the existing threshold engine. Above-threshold inserts land as `pending` with no journal; under-threshold auto-approve and post normally.

## 2. Permissions matrix (`src/lib/permissions.ts`)
Add `"office"` to `UserRole`. Section access:

| Section | Access |
|---|---|
| alerts, transactions, contacts, inventory, fuel, equipment, operations, herbicide, rainfall, cronograma, industrial, hr | **Read + Write** |
| accounting (Ledger), invoices, reports, analytics, ap-ar | **Read-only** |
| treasury | **Read-only** view, **Write** only on petty cash (enforced in `PettyCashView` + RLS) |
| settings, budget, approvals, payroll (HR sub-tab) | **No access** |

HR sub-tabs for office: `day-labor`, `servicios`, `jornaleros`, `prestadores`, `employees` (read+write). Block `payroll`, `add-employee`, `tss`.

Add helper `canWritePettyCash(role)` returning true for `admin`, `management`, `accountant`, `office`.

## 3. UI changes
- **`UserManagement.tsx`**: add "Oficina" to role dropdown + `roleDisplayNames`/`roleDescriptions`.
- **`TransactionForm.tsx`**: when current role is `office`, show an info banner: *"Las transacciones que excedan el umbral de aprobación quedarán en estado pendiente hasta ser aprobadas."*
- **`TreasuryView.tsx`**: hide write actions on bank/credit card tabs for office; keep petty cash tab fully interactive.
- **`PettyCashView.tsx`**: gate write buttons via `canWritePettyCash`.
- **Sidebar**: existing `canAccessSection` filtering handles visibility automatically.

## 4. Edge function
- **`update-user-role/index.ts`**: add `'office'` to `VALID_ROLES`.

## 5. i18n
- Add `roles.office`, banner copy, and any new labels to `src/i18n/es.ts` and `src/i18n/en.ts`.

## Files to touch
- New SQL migration (enum + RLS)
- `src/lib/permissions.ts`
- `src/contexts/AuthContext.tsx` (if role-derived flags need updating)
- `src/components/settings/UserManagement.tsx`
- `src/components/transactions/TransactionForm.tsx`
- `src/components/accounting/TreasuryView.tsx`
- `src/components/accounting/PettyCashView.tsx`
- `supabase/functions/update-user-role/index.ts`
- `src/i18n/es.ts`, `src/i18n/en.ts`

## Out of scope
- No changes to approval thresholds — admins configure office's limits via existing **Settings → Approval Thresholds** UI by selecting the `office` role after this ships.
