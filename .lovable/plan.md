

## Fix: Accounting Report Row Limits + Journal Pagination & Export

### Issue 1: AccountingReportsView — 1,000-row silent truncation

Replace single query with recursive paginated fetch using `.range(offset, offset+999)` loop until fewer than 1,000 rows return.

**File**: `src/components/accounting/AccountingReportsView.tsx`

### Issue 2: JournalView — hard `.limit(200)`

- Remove `.limit(200)`
- Add date-range filter inputs (default: current month)
- Add `usePagination` hook for client-side paging
- Render page controls below the table

**File**: `src/components/accounting/JournalView.tsx`

### Issue 3: JournalView — Excel/PDF export

Add "Exportar" dropdown using `useExport` hook. Export is **line-level** (one row per journal line), which is standard for accounting exports:

| Column | Source |
|--------|--------|
| Número | `journal_number` |
| Tipo | `journal_type` |
| Fecha | `journal_date` |
| Descripción | journal `description` |
| Cuenta | `chart_of_accounts.account_code` |
| Nombre Cuenta | `chart_of_accounts.account_name` |
| Proyecto | line `project_code` |
| CBS | line `cbs_code` |
| Detalle Línea | line `description` |
| Moneda | `currency` |
| Débito | line `debit` |
| Crédito | line `credit` |
| Estado | posted/draft |

No `transaction_source_id` — it's an internal FK, not useful in reports.

**File**: `src/components/accounting/JournalView.tsx`

### Files changed

| File | Change |
|------|--------|
| `AccountingReportsView.tsx` | Recursive paginated fetch |
| `JournalView.tsx` | Date filters, pagination, export dropdown with line-level columns |

No database changes required.

