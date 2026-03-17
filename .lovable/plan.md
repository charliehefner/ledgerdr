

# Fix Remaining Hardcoded Spanish in Accounting Module

## Problem
Several accounting components still have hardcoded Spanish strings that don't respond to the language toggle. This affects the Reports toolbar, quick-action buttons, AgingReportView, and pay method labels.

## Files & Changes

### 1. `src/i18n/en.ts` and `src/i18n/es.ts`
Add ~25 new keys:
- `acctReport.reportType` — "Report Type" / "Tipo de Informe"
- `acctReport.selectReportOrFilters` — description for empty state
- `acctReport.payMethod` — "Payment Method" / "Método de Pago"
- `acctReport.col.payMethod` — "Pay Method" / "Método Pago"
- `accounting.tb.title` already exists → reuse for button/dropdown
- `aging.title` — "Aging Report" / "Antigüedad de Saldos"
- `aging.noDocuments` — "No documents with outstanding balances." / "No hay documentos con saldos pendientes."
- `aging.all` / `aging.payable` / `aging.receivable` — "All" / "Accounts Payable" / "Accounts Receivable"
- `aging.contactsWithBalance` — "contacts with open balances" / "contactos con saldos abiertos"
- `aging.col.name` / `aging.col.currency` / `aging.col.current` / `aging.col.days30` / `aging.col.days60` / `aging.col.days90` / `aging.col.over90`
- Pay method labels: `payMethod.cash` / `payMethod.ccAgricultural` / `payMethod.ccIndustrial`

### 2. `src/components/accounting/AccountingReportsView.tsx`
- Line 79: `"Efectivo"` → `t("payMethod.cash")`
- Line 81-82: CC Agrícola/Industrial labels → translated
- Line 256: `"Método Pago:"` → `t("acctReport.col.payMethod")`
- Line 272: `"Método Pago"` column header → `t("acctReport.col.payMethod")`
- Line 292: Excel header `"Método Pago"` → `t("acctReport.col.payMethod")`
- Line 385: `"Tipo de Informe"` → `t("acctReport.reportType")`
- Line 394: `"Balanza de Comprobación"` → `t("accounting.tb.title")`
- Line 395: `"Antigüedad de Saldos"` → `t("aging.title")`
- Line 422: Empty state description → `t("acctReport.selectReportOrFilters")`
- Lines 431-435: Quick-action buttons → use `t("pl.title")`, `t("bs.title")`, `t("accounting.tb.title")`, `t("cf.title")`, `t("aging.title")`
- Line 609: `"Método de Pago"` label → `t("acctReport.payMethod")`
- Convert `PAY_METHOD_LABELS` from static object to language-aware (using `useMemo` keyed on `language`)

### 3. `src/components/accounting/AgingReportView.tsx`
- Lines 117-124, 136-143: Export column headers → translated
- Line 130, 155: Export title → `t("aging.title")`
- Lines 169-172: Filter select items → translated
- Line 175: "contactos con saldos abiertos" → translated
- Line 180: "Exportar" button → `t("acctReport.export")` (reuse existing key)
- Lines 192-193: Empty state title/description → translated
- Lines 200-207: Table headers → translated

