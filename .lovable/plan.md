

# Fix AP/AR Type Badge and Contact Column Clarity

## Problems

1. **Type badge shows raw key `apar.bill`** — The backfill migration sets `document_type = 'bill'` for payables, but there is no translation for `apar.bill`. The badge renders the untranslated key string.

2. **Contact column is generic** — The header says "Nombre del Contacto" for both receivables and payables. For payables, it should say "Proveedor" (vendor/owed to); for receivables, "Cliente" (customer).

## Changes

### 1. Add "bill" translation and include it in the document type selector

**Files:** `src/i18n/es.ts`, `src/i18n/en.ts`
- Add `"apar.bill": "Factura Proveedor"` (ES) / `"Bill"` (EN)

**File:** `src/components/accounting/ApArDocumentList.tsx`
- Add `<SelectItem value="bill">` to the New Document dialog type selector (only when `direction === "payable"`)

### 2. Context-aware contact column header

**File:** `src/components/accounting/ApArDocumentList.tsx`
- Change the contact column header from `t("apar.contactName")` to direction-specific labels:
  - Payable → "Proveedor" (new key `apar.vendor`)
  - Receivable → "Cliente" (new key `apar.customer`)

**Files:** `src/i18n/es.ts`, `src/i18n/en.ts`
- Add `"apar.vendor": "Proveedor"` / `"Vendor"`
- Add `"apar.customer": "Cliente"` / `"Customer"`

### Summary of translation keys to add

| Key | ES | EN |
|-----|----|----|
| `apar.bill` | Factura Proveedor | Bill |
| `apar.vendor` | Proveedor | Vendor |
| `apar.customer` | Cliente | Customer |

