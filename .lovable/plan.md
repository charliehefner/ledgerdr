

# Expand Editable Fields + Update DGII Tooltip Text

## Overview

Two changes: (1) make DGII-critical fields editable in the Edit Transaction Dialog, and (2) update the DGII report tooltip texts to mention that corrections can be made in Financial Ledger.

## 1. Expand Editable Fields in EditTransactionDialog

Currently only **Document #** and **Description** are editable. The following fields will be made editable to allow DGII report corrections without voiding:

| Field | DB Column | UI Control |
|---|---|---|
| RNC | `rnc` | Text input |
| ITBIS | `itbis` | Number input |
| ITBIS Retenido | `itbis_retenido` | Number input |
| ISR Retenido | `isr_retenido` | Number input |
| Payment Method | `pay_method` | Select dropdown (same options as TransactionForm) |
| Tipo Bienes/Servicios | `dgii_tipo_bienes_servicios` | Select dropdown (codes 01-13) |

The save button currently sits next to Document #. It will be moved to the dialog footer as a standalone "Save Changes" button, and all editable fields will lose their `readOnly` + `bg-muted` styling.

### Files Changed

**`src/components/invoices/EditTransactionDialog.tsx`**
- Add state variables for each new editable field (+ original values for change detection)
- Remove `readOnly` and `bg-muted` from RNC, ITBIS, ITBIS Retenido, ISR Retenido, Payment Method fields
- Add new DGII Tipo Bienes/Servicios select field (for purchase transactions)
- Move Save button to footer next to existing Cerrar/Anular buttons
- Update `hasChanges` logic to include all new fields
- Update `handleSaveChanges` to send all changed fields

**`src/lib/api.ts`**
- Update `updateTransaction` to pass through all fields from the partial transaction object instead of only `document`
- Also support finding by UUID (not just legacy_id) for newer records

## 2. Update DGII Tooltip Text

Update the 606, 607, and 608 tooltip translations to mention that errors can be corrected in the Financial Ledger.

**`src/contexts/LanguageContext.tsx`** -- update 6 strings (3 Spanish, 3 English):

| Key | New Spanish | New English |
|---|---|---|
| help.dgii606 | Reporte de compras y gastos con comprobantes fiscales. Exporta a Excel para entrada al portal de la DGII. Para corregir datos, edite la transaccion en Libro Mayor. | Purchase and expense report with fiscal receipts. Exports to Excel for DGII portal entry. To correct data, edit the transaction in Financial Ledger. |
| help.dgii607 | Reporte de ventas con comprobantes fiscales. Exporta a Excel para entrada al portal de la DGII. Para corregir datos, edite la transaccion en Libro Mayor. | Sales report with fiscal receipts. Exports to Excel for DGII portal entry. To correct data, edit the transaction in Financial Ledger. |
| help.dgii608 | Reporte de comprobantes anulados. Exporta a Excel para entrada al portal de la DGII. Para corregir datos, edite la transaccion en Libro Mayor. | Voided fiscal receipts report. Exports to Excel for DGII portal entry. To correct data, edit the transaction in Financial Ledger. |

## Technical Details

### updateTransaction (api.ts) fix

The current function hardcodes only `document` in the update payload. It will be changed to spread all provided fields:

```typescript
const updatePayload: Record<string, any> = {};
if (transaction.document !== undefined) updatePayload.document = transaction.document;
if (transaction.description !== undefined) updatePayload.description = transaction.description;
if (transaction.rnc !== undefined) updatePayload.rnc = transaction.rnc;
if (transaction.itbis !== undefined) updatePayload.itbis = transaction.itbis;
if (transaction.pay_method !== undefined) updatePayload.pay_method = transaction.pay_method;
// ... etc for all DGII fields
```

### EditTransactionDialog state management

Each new editable field gets an `edited` + `original` state pair (same pattern as document/description), and `hasChanges` checks all pairs.

### Files summary

| File | Change |
|---|---|
| `src/components/invoices/EditTransactionDialog.tsx` | Expand editable fields, move save to footer |
| `src/lib/api.ts` | `updateTransaction` accepts all DGII-relevant fields |
| `src/contexts/LanguageContext.tsx` | Update 6 tooltip strings |

