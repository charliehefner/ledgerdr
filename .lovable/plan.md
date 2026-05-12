## Goal

Add a dedicated way to register cash overages (**sobras**) and shortages (**faltantes**) of petty cash, separate from the replenishment flow, with a clear audit trail and proper accounting.

## UI changes — `src/components/accounting/PettyCashView.tsx`

In each row of the Petty Cash funds table, add a third icon-button next to the existing **Edit** and **Replenish** icons:

- Icon: `Scale` (or `AlertTriangle`) from lucide-react
- Tooltip: **"Registrar sobra/falta de caja"**
- Visible only when `canManageFunds` is true and the fund has a `chart_account_id` set
- Opens a new `CashAdjustmentDialog` for that fund

## New component — `src/components/accounting/CashAdjustmentDialog.tsx`

Modal that captures one cash-difference event.

Fields:
- **Tipo** (radio / segmented): `Sobra` (over) or `Falta` (short)
- **Monto** (positive number, DOP/fund currency, font-mono)
- **Fecha** (defaults to today, validated against closed periods like every other Treasury form)
- **Motivo / descripción** (textarea, required, e.g. "Conteo del 12 May 2026 — diferencia de RD$50")

Submit handler inserts a single row into `transactions`, mirroring the pattern used by `ReplenishmentDialog` so the existing journal-generation trigger handles double entry:

- **Falta (cash short)** — cash leaves the fund, expense booked.
  - `pay_method` = fund.id (petty cash)
  - `destination_acct_code` = `7990` (Otros gastos de explotación)
  - `account_code` = `7990`
  - Description prefixed `"Faltante de caja: "`
- **Sobra (cash over)** — cash enters the fund, income booked.
  - `pay_method` = `3990` (Otras remuneraciones, subvenciones e ingresos)
  - `destination_acct_code` = fund.id
  - `account_code` = `3990`
  - Description prefixed `"Sobrante de caja: "`

Both insert `entity_id` from `useEntity().selectedEntityId`, `currency` from the fund, and `name` = fund.account_name. Exact field shape will be verified against `ReplenishmentDialog` and the journal trigger before implementation; if the trigger requires a different driver (e.g. a direct `journal_entries` insert via RPC), I will use that instead — accounting impact must end up as **Dr 7990 / Cr [petty cash GL]** for falta and **Dr [petty cash GL] / Cr 3990** for sobra.

On success: invalidate `petty-cash-transactions`, `petty-cash-gl-balances`, `last-replenishment`, `petty-cash-expenses-since`. Toast confirmation. Close.

## Recent transactions table

Already shows new transactions automatically. The `Tipo` badge currently shows `Recharge` vs `Expense`. Detect cash adjustments by `account_code` and show a third badge value: `Sobra` / `Falta` so they stand out in the ledger.

## i18n

Add Spanish + English keys under `treasury.pc.adjust.*` for: button tooltip, dialog title, type labels, amount label, date label, reason label, submit/cancel, success toast, validation errors, badge labels.

## Out of scope

- No new chart-of-accounts entries (using existing 7990 / 3990 per user choice).
- No changes to replenishment math — the over/short detected during replenishment continues to flow through 0000 as it does today. This new button is for **standalone** adjustments outside a replenishment cycle (e.g. spot count by Accountant).
- No changes to permissions; same `canManagePettyCashFunds` check as Edit/Replenish.

## Verification

- Falta of RD$100 → ledger shows Dr 7990 100 / Cr 1911 100; petty cash GL balance drops by 100.
- Sobra of RD$50 → Dr 1911 50 / Cr 3990 50; petty cash GL balance rises by 50.
- Both rows appear in "Recent Petty Cash Transactions" with the new `Sobra`/`Falta` badge and the user's reason in the description.
- Closed-period validation blocks dates inside locked periods (same as existing Treasury inserts).
- Office role can also use the button (since they own petty cash); other read-only roles cannot.

Reply **"go"** (or click Implement) to proceed.