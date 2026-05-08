## Credit Card Payment Flow — Treasury

### Goal
Separate **credit card payments** (settling a 21xx liability) from **internal transfers** (asset ↔ asset), matching standard accounting practice and how QuickBooks/Xero present these flows. Today, paying a card is done through `InternalTransfersView` (cards are allowed as destination), which conflates a debt paydown with a cash-position-neutral transfer.

### Outcome for the user
- New tab in **Treasury → "Pagos de Tarjeta de Crédito"**.
- Internal Transfers becomes strictly asset↔asset (cards removed as a destination).
- Card payments produce the correct GL entry: `Dr 21xx Tarjeta / Cr 11xx Banco`, never an asset-to-asset transfer.

---

### UI — `CreditCardPaymentsView`

Layout mirrors `InternalTransfersView` for consistency:

1. **Form: "Nuevo Pago de Tarjeta"**
   - Fecha *
   - Tarjeta de Crédito * (select — only `bank_accounts.account_type = 'credit_card'`)
   - Cuenta Bancaria de Origen * (select — only `account_type = 'bank'` or `petty_cash`)
   - Monto Pagado (moneda banco) *
   - Monto Aplicado a Tarjeta (moneda tarjeta) — shown only when card currency ≠ bank currency
   - Descripción (optional, prefilled: `Pago tarjeta {card} desde {bank}`)
   - Botón "Registrar Pago"

2. **Tabla: "Pagos Recientes"** (last 25)
   - ID (legacy_id), Fecha, Tarjeta, Banco Origen, Monto, Estado (Posteado / Sin postear), Acciones (editar si no posteado)

3. **Edit dialog** — minimal, mirrors creation form (same pattern as `EditInternalTransferDialog`).

### Wiring in `TreasuryView.tsx`
Add tab `credit-card-payments` between `credit-cards` and `internal-transfers` (hidden for `office` role, like the others).

### Removal from Internal Transfers
- In `InternalTransfersView.renderAccountOptions`, drop the `includeCards` branch entirely. Cards no longer appear in either origin or destination selectors.
- Update form copy to reflect "asset ↔ asset" only.
- Existing historical card-destination transfers remain visible in "Pagos Recientes" (no data migration); the edit dialog still works because it just edits the underlying transaction.

---

### Backend / data model

We **reuse the existing transaction infrastructure** — no new tables. A credit card payment is recorded as a `transactions` row with:

| Field | Value |
|---|---|
| `transaction_direction` | `payment` |
| `is_internal` | `false` (it pays a 3rd-party liability) |
| `master_acct_code` | the card's mapped 21xx chart account (debit side) |
| `pay_method` | the source bank `bank_accounts.id` (credit side) |
| `destination_acct_code` | the credit card `bank_accounts.id` (for traceability/UI filtering) |
| `cost_center` | `general` |
| `amount` / `destination_amount` | source / dest amounts (FX support) |
| `name` | the card issuer (auto from card metadata, e.g., "Banco Popular Visa") |

This produces the proper journal `Dr 21xx / Cr 11xx` via the existing `create_transaction_with_ap_ar` RPC and journal generator — no new GL logic required.

A new RPC `update_credit_card_payment` (mirroring `update_internal_transfer`) handles in-place edits with the same safeguards: unposted-only, period-lock check, regenerate journals.

#### Distinguishing payments from regular purchases
A CC payment is identifiable by:
- `transaction_direction = 'payment'`
- `pay_method` references a `bank_accounts` row of type `bank` / `petty_cash`
- `destination_acct_code` references a `bank_accounts` row of type `credit_card`

The "Pagos Recientes" query filters on these conditions. Optional: add a `payment_kind` enum later if we want stronger typing — not needed for v1.

#### Backwards compatibility
Existing card-destination internal transfers (rows with `is_internal = true` + card destination) keep working. Going forward, the new flow sets `is_internal = false`. Both surfaces (Internal Transfers list and Card Payments list) will show the relevant subset using their respective filters.

---

### Files

**New**
- `src/components/accounting/CreditCardPaymentsView.tsx`
- `src/components/accounting/EditCreditCardPaymentDialog.tsx`
- Migration: `update_credit_card_payment` RPC

**Edited**
- `src/components/accounting/TreasuryView.tsx` — add tab
- `src/components/accounting/InternalTransfersView.tsx` — remove credit_card option from destination selector, tighten copy
- `src/i18n/es.ts` / `src/i18n/en.ts` — new strings (`treasury.ccPay.*`)

### Out of scope (v1)
- Statement-based reconciliation (matching payment to a CC statement period) — can be a follow-up under Bank Reconciliation if needed.
- Partial-payment allocation to specific CC charges — current model treats payment as a balance paydown, which matches standard practice.
