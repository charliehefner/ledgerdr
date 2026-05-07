# Supplier Advances in Treasury

## Accounting reasoning (why this design)

Standard AP practice (and what GP/QuickBooks/Odoo do):

- **Advance** = prepayment debited to **1690 Anticipos a Suppliers** (asset), credited to bank/cash. It is *not* a purchase, has no NCF, no ITBIS-on-cost, no inventory movement.
- **Retention on advances**: in DR, retentions normally accrue with the **invoice** (the taxable event). However, when a payment is the trigger for retention (e.g. ISR 2% to informal services), some firms book it on the advance. We will support both: retention fields are **optional**, default zero.
- **Open advance alert**: every reputable AP module checks for unapplied prepayments before posting a new invoice/payment to the same vendor and prompts to apply. This already exists conceptually in `advance_allocations` but isn't surfaced at entry time.
- **Supplier master**: AP master data must be tighter than CRM. RNC, bank, currency, attachments, active flag — same shape as `service_providers`.

## Scope

1. **`suppliers` table** (new), modeled on `service_providers`.
2. **Treasury → "Anticipo a Suppliers"** button + dialog.
3. **Open-advance warning** in `TransactionForm` when supplier has open 1690 balance.
4. **Suppliers admin view** in Settings.

---

## 1. Database

New table `public.suppliers`:

```text
id, entity_id (NOT NULL, default current_user_entity_id())
name, rnc (unique per entity), apodo
contact_person, phone, email, address
bank, bank_account_type (savings|current), bank_account_number, currency (DOP|USD|EUR)
default_dgii_bs_type (B|S, nullable)        -- prefill 606
rnc_attachment_url, notes
is_active (default true), created_at, updated_at
```

RLS: copy from `service_providers` (admin/mgmt/accountant/supervisor write; viewer read; office read-only).

Helper RPC `get_supplier_open_advance_balance(p_supplier_id, p_entity_id) returns numeric`:
- Sum `balance_remaining` from `ap_ar_documents` where `account_id` = 1690, direction='payable', status in ('open','partial'), and either linked to supplier_id or matched by RNC for grandfathered rows.

New RPC `create_supplier_advance(...)` (called by Treasury form):
- Inputs: `p_supplier_id, p_date, p_from_account, p_amount, p_currency, p_itbis_retained, p_isr_retained, p_notes, p_attachment_url`
- Inserts a `transactions` row with `master_acct_code='1690'`, `is_internal=false`, `transaction_direction='purchase'`, `pay_method=p_from_account`.
- Net cash out = `amount − itbis_retained − isr_retained`.
- If retentions > 0: posts credits to **2105 ITBIS Retenido** and **2106 ISR Retenido** via journal lines on the same transaction.
- Creates `ap_ar_documents` row (advance) with `account_id`=1690 so existing allocation flow works.
- Returns transaction id + advance doc id.

Add `supplier_id uuid references suppliers(id)` (nullable) to:
- `transactions` (so future entries link cleanly)
- `ap_ar_documents` (so allocation can match by id, not just RNC)

No backfill of historical rows (per "grandfather old" decision).

---

## 2. Treasury UI

`TreasuryView.tsx`: add **"Anticipos a Suppliers"** tab beside Internal Transfers (same `!isOffice` gate).

New `src/components/accounting/SupplierAdvancesView.tsx`:

- Top: "Nuevo Anticipo" button → `SupplierAdvanceDialog`.
- Below: table of recent advances (date, supplier, amount, currency, balance remaining, status, attachment).

`SupplierAdvanceDialog` fields:
- Date (default today)
- Supplier (searchable combobox sourced from `suppliers`; "+ Registrar nuevo" inline opens `SupplierFormDialog`)
- From account (bank/cash/card list, currency auto-derived)
- Currency (read-only, from account)
- Amount
- ITBIS Retenido (optional, default 0) — collapsible "Retenciones" section
- ISR Retenido (optional, default 0)
- Notes, attachment upload
- Computed read-only: "Neto a desembolsar" = amount − retenciones

Submit calls `create_supplier_advance` RPC.

---

## 3. Suppliers registry UI

New `src/components/settings/SuppliersView.tsx` (added as a tab under Settings, beside Service Providers):
- List with search, active toggle, edit/create dialog.
- Same RLS-driven actions as service providers.

`SupplierFormDialog`: name, RNC (validated), apodo, contact, phone, email, bank info, currency, default B/S, attachment, active.

---

## 4. Open-advance warning in Transactions

`TransactionForm.tsx`:
- When direction = `purchase` AND a supplier is selected (new combobox replacing free-text name for purchases going forward), call `get_supplier_open_advance_balance` (debounced).
- If balance > 0, show non-blocking inline banner: *"Este suplidor tiene RD$ X,XXX en anticipos abiertos."* with a link to ApArDocumentList filtered by supplier.
- On submit, if balance > 0, open confirm modal:
  - Title: "Anticipos pendientes"
  - Body: list open advance docs + balances
  - Buttons:
    - "Aplicar contra anticipo" → routes to existing allocation flow
    - "Continuar sin aplicar" → only enabled for roles `admin | management | accountant`; logs override reason (textarea required) into `transactions.notes` and an audit row.
    - "Cancelar"
- Supervisor / Office cannot dismiss the modal (per decision).

For grandfathered free-text rows, supplier match falls back to RNC equality.

---

## 5. Permissions, i18n, tests

- RLS verified on `suppliers` and new RPCs.
- ES + EN strings for the new tab, dialog, retention labels, and override modal.
- Vitest unit test for `create_supplier_advance` net-cash math and journal balance.
- Vitest test for the open-advance hook returning the right balance per supplier.

---

## Out of scope (call out)

- No retroactive enforcement on legacy purchase transactions; they keep free-text contact_name.
- No automated supplier creation from existing contacts; admins promote on demand.
- e-CF / 606 emission for the advance itself is unchanged (advances are not reported on 606 — only the eventual invoice is).
