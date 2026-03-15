

# Final Market-Readiness Assessment

After a thorough sweep of the entire codebase — API layer, DGII reports, scaling limits, permissions, authentication, edit dialogs, and data integrity triggers — the system is in strong shape. The three prior audit rounds addressed the critical gaps. Here is what remains:

---

## Remaining Items (Minor)

### 1. DGII 606 — Missing "Fecha de Pago" Column
The DGII's official 606 format requires a **Fecha de Pago** column (payment date, distinct from the invoice date for credit purchases). The current 606 export only has "Fecha Comprobante". For credit purchases (`pay_method = 'credit'`), the payment date should differ from the document date. Currently, the `purchase_date` field exists on the transaction model but is not mapped to the 606 output.

**Fix**: Add a `fechaPago` column to `DGII606Table` mapped from `purchase_date || transaction_date` (fallback to transaction date if no purchase date). Add the column to both the copy-to-clipboard and Excel export.

### 2. DGII 606/607 — Missing "NCF Modificado" Column
The DGII format includes an "NCF o Documento Modificado" column (for credit notes that reference an original NCF). This column can be empty for most transactions but must exist in the export file for the DGII upload tool to accept it.

**Fix**: Add an empty `ncfModificado` column to both 606 and 607 table/export. The column is blank unless a future credit-note linking feature populates it.

### 3. FiscalDocumentsReport — Missing Row Limit
`src/components/dashboard/FiscalDocumentsReport.tsx` queries transactions without `.limit()`, hitting the default 1,000-row cap. For companies with heavy E31/B01 volume this silently truncates data.

**Fix**: Add `.limit(10000)` to the query at line 61.

### 4. `purchase_date` Not Persisted on Create
The `TransactionForm` has a `purchase_date` field in its state, but `createTransaction()` in `api.ts` does not include `purchase_date` in the insert payload. The value is silently dropped.

**Fix**: Add `purchase_date: transaction.purchase_date || null` to the insert payload in `createTransaction()` and to `updateTransaction()`.

---

## Already Solid (No Action Needed)

- **Multi-currency RPCs**: All use `COALESCE(exchange_rate, 1)` — correct
- **ITBIS override**: Present in both create form, edit dialog, and API layer — complete
- **Row limits**: All major queries (DGII, Aging, Bank Recon, COA, AP/AR, Journals, Accounting Reports) use pagination or `.limit(10000)` — complete
- **Period enforcement**: One-way status transitions via SQL trigger — complete
- **Void reversal journals**: Automatic via SQL trigger — complete
- **DGII auto-mapping**: `dgii_tipo_bienes_servicios` auto-set via trigger — complete
- **TSS externalization**: Rates loaded from database — complete
- **Permissions/RBAC**: Comprehensive role matrix with proper `has_role()` security definer — solid
- **Auth**: Server-side role fetch with retries and timeout — robust

---

## Implementation Plan

| # | Task | Files |
|---|------|-------|
| 1 | Add `purchase_date` to API insert/update payloads | `src/lib/api.ts` |
| 2 | Add Fecha de Pago + NCF Modificado columns to 606 | `DGII606Table.tsx`, `DGIIReportsView.tsx` (add `purchase_date` to select) |
| 3 | Add NCF Modificado column to 607 | `DGII607Table.tsx` |
| 4 | Add `.limit(10000)` to FiscalDocumentsReport | `FiscalDocumentsReport.tsx` |

Estimated scope: 4 small, targeted edits. No database migrations needed.

