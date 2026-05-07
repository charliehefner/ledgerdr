# Supplier Contracts + Advance linkage

## Clarifications first

- **"Neto a desembolsar"** = net cash leaving your bank/cash account = `Monto − ITBIS retenido − ISR retenido`. Retentions stay with you as a liability owed to DGII (accounts 2105/2106); the supplier only receives the net. Label will be renamed to **"Monto a pagar al suplidor"** and only shown when retentions > 0.
- **Source vs destination**: An advance always debits **1690 Anticipos a Suplidores** (asset). There is no "destination expense account" at the advance step — that account is chosen later when the supplier's invoice arrives and the advance is applied. Contracts let us pre-declare what that destination *will be*.

---

## 1. Database — `supplier_contracts`

New table:

```text
id, entity_id (NOT NULL)
supplier_id (FK suppliers, NOT NULL)
contract_number (optional, unique per supplier+entity)
description (text, required)
total_amount (numeric, required)
currency (DOP|USD|EUR, required)
default_account_code (FK accounts, required)   -- expense or asset/project
cost_center_id (FK cost_centers, nullable)     -- General | Agrícola | Industrial
start_date, end_date (nullable)
attachment_url (signed contract PDF)
status (draft | active | closed | cancelled)
notes
is_active, created_at, updated_at, created_by
```

RLS: same pattern as `suppliers` (admin/mgmt/accountant write; supervisor/viewer read; office read-only).

**Helper view / RPC** `get_contract_balance(p_contract_id)` returns:
- `total_amount`
- `advanced_to_date` — sum of advances linked to contract (transactions with `master_acct_code='1690'` AND `contract_id = p_contract_id`)
- `applied_to_date` — sum of advance allocations against invoices for the contract
- `available` = `total_amount − advanced_to_date`

Add nullable FK `contract_id uuid references supplier_contracts(id)` on:
- `transactions` (so advances and eventual invoices both link)
- `ap_ar_documents`

No backfill of old rows.

---

## 2. Suppliers settings — secondary "Contratos" panel

In `SuppliersView.tsx`, when a supplier row is selected (or via an "Contratos" action button), open a side sheet showing:
- List of that supplier's contracts with: number, description, currency, total, advanced, available, status.
- "Nuevo contrato" button opens `SupplierContractDialog` with: description, contract number (optional), total amount, currency, default account (account picker scoped to expense + project asset accounts), cost center (optional), start/end, attachment, notes.
- Edit dialog allows adjusting `total_amount` (audited via `notes` + audit row) — your "adjusted over time" requirement.
- Status toggle: draft → active → closed.

---

## 3. Supplier Advance dialog — contract field

Update `SupplierAdvanceDialog`:

1. After supplier is selected, query active contracts for that supplier.
2. New optional field **"Contrato"** (combobox). If supplier has contracts, default to "Sin contrato" but offer the list. If no contracts exist, field stays hidden.
3. When a contract is picked:
   - Show inline: `Total: X · Anticipado: Y · Disponible: Z` (live from `get_contract_balance`).
   - Default-lock the **currency** to the contract currency.
   - Persist `contract_id` on the resulting transaction and `ap_ar_documents` row.
4. Rename "Neto a desembolsar" → **"Monto a pagar al suplidor"**, hide row when retenciones = 0.

**Over-advance warning**: on submit, if `(advanced_to_date + amount) > total_amount`:
- Show modal listing the contract, current advanced, this amount, overage.
- Buttons: "Cancelar" / "Continuar de todos modos" (latter only enabled for `admin | management | accountant`, requires reason → stored in `transactions.notes` + audit row). Same pattern as the open-advance alert.

---

## 4. Treasury Supplier Advances list

Add a "Contrato" column showing contract number + small available-balance chip when present.

---

## 5. Future-proofing (not built now, just enabled by schema)

- The same `contract_id` FK on `transactions` lets a future invoice entry pre-fill the expense account from the contract and auto-suggest applying open advances under that contract. Out of scope for this iteration — only the advance side links.
- Per-line / milestone contracts can be added later as a child table without changing the parent.

---

## Out of scope

- No PO/3-way match.
- No contract-line items or milestones (per "Simple: amount + account" decision).
- No automatic application of advances to invoices via contract — manual allocation flow remains as today.
- Existing free-text advances stay as-is; contracts are forward-only.

---

## Technical notes (for reviewer)

- New table `public.supplier_contracts` + nullable `contract_id` columns on `transactions` and `ap_ar_documents`.
- `create_supplier_advance` RPC (and the underlying `create_transaction_with_ap_ar` overload it calls) gains a `p_contract_id uuid default null` parameter. Drop prior overload to avoid PostgREST ambiguity (same pattern used after the supplier_id rollout).
- Server-side validation in the RPC re-checks the contract balance to prevent client bypass; an `p_force boolean default false` flag plus role check (admin/management/accountant) is required to exceed.
- Account picker on the contract dialog filters chart of accounts to expense (5xxx/6xxx/7xxx) + asset/project accounts; cost center dropdown reuses existing `cost_centers` lookup.
- All new strings added to `src/i18n/es.ts` and `src/i18n/en.ts` (default Spanish).
- Vitest: unit test for `get_contract_balance` math and over-advance gating; UI test for currency auto-lock when contract selected.
