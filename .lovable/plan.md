

## Plan: Supplier Advances (Anticipos a Proveedores)

### Summary

Add supplier advance tracking to the existing AP/AR module. Advances are assets (account 1690) that can be applied against supplier invoices (bills) to reduce their payable balance.

### User Workflow

1. **Pay advance** → Create transaction in Transactions page using account 1690. System auto-creates an AP/AR document with `document_type='advance'`.
2. **View advances** → In Cuentas por Pagar tab, filter by "Anticipos" to see open advances per supplier.
3. **Receive NCF invoice** → Create a new bill directly in the AP/AR page (existing flow).
4. **Apply advance** → Click "Aplicar Anticipo" on the invoice row. Dialog shows available advances for the same supplier (matched by `contact_name`/`contact_rnc`). Enter allocation amount.
5. **Pay remainder** → Use existing Payment dialog for any remaining balance.

---

### Database Changes

**1. Insert account 1690 into `chart_of_accounts`**
- Code: `1690`, Name: "Anticipos a Proveedores", English: "Advances to Suppliers", Type: ASSET, allow_posting: true

**2. Create `advance_allocations` table**
```sql
CREATE TABLE advance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_doc_id UUID NOT NULL REFERENCES ap_ar_documents(id),
  invoice_doc_id UUID NOT NULL REFERENCES ap_ar_documents(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  allocated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```
With RLS policies matching existing AP/AR tables.

**3. Trigger: `sync_advance_allocation_balances`**
- AFTER INSERT on `advance_allocations`: update `amount_paid` and `balance_remaining` on both the advance doc and the invoice doc; update `status` to `partial` or `paid` as appropriate.

**4. Trigger: `validate_advance_allocation`**
- BEFORE INSERT on `advance_allocations`: verify amount ≤ advance's `balance_remaining`, verify amount ≤ invoice's `balance_remaining`, verify both documents share the same `contact_name`.

---

### Code Changes

**`src/components/transactions/TransactionForm.tsx`**
- Extend the auto-creation logic: when `master_acct_code` starts with `1690`, auto-create an `ap_ar_documents` record with `document_type: 'advance'`, `direction: 'payable'`, and `account_id` pointing to account 1690.

**`src/components/accounting/ApArDocumentList.tsx`**
- Expand GL account fetch: when `direction === 'payable'`, also fetch accounts starting with `1690` alongside `24%`.
- Add filter chips: "Todos" / "Facturas" / "Anticipos" to filter by `document_type`.
- Add "Aplicar Anticipo" button on invoice/bill rows (visible when open advances exist for same supplier).
- New `AdvanceAllocationDialog` component inline: shows available advances for the supplier, lets user enter partial amount, inserts into `advance_allocations`.

**`src/i18n/es.ts` and `src/i18n/en.ts`**
- Add keys: `apar.advance`, `apar.advances`, `apar.applyAdvance`, `apar.allTypes`, `apar.invoicesOnly`, `apar.advancesOnly`, `apar.availableAdvances`, `apar.allocationAmount`, `apar.noAdvances`.

---

### Files Changed

| File | Change |
|------|--------|
| SQL Migration | Create `advance_allocations` table + validation/sync triggers + RLS |
| SQL Insert | Add account 1690 to `chart_of_accounts` |
| `src/components/accounting/ApArDocumentList.tsx` | Add advance filter chips, "Aplicar Anticipo" button, allocation dialog |
| `src/components/transactions/TransactionForm.tsx` | Detect account 1690 to auto-create advance AP/AR doc |
| `src/i18n/es.ts` | Add advance-related translation keys |
| `src/i18n/en.ts` | Add advance-related translation keys |

