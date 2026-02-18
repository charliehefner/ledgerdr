

# DGII Reports (606, 607, 608) for Accounting Module

## Overview

Add a "Reportes DGII" button/section to the Accounting page that generates the three mandatory Dominican Republic tax report formats. Each report will display in a table that matches the DGII Excel template columns, making it easy to copy-paste into the official DGII spreadsheet. Reports can also be exported directly to Excel.

## What Each Format Contains

- **606 (Compras de Bienes y Servicios)**: All purchases/expenses for the month -- supplier RNC, NCF, date, amount, ITBIS, retentions, payment method, type of goods/service
- **607 (Ventas de Bienes y Servicios)**: All sales for the month -- customer RNC, NCF, date, amount, ITBIS, income type
- **608 (Comprobantes Anulados)**: Voided NCFs for the month -- NCF number, date, cancellation reason code

## Database Changes

Add the following columns to the `transactions` table:

| New Column | Type | Purpose |
|---|---|---|
| `dgii_tipo_bienes_servicios` | text | DGII code (01-13) for type of goods/services purchased |
| `itbis_retenido` | numeric | ITBIS withholding amount |
| `isr_retenido` | numeric | ISR withholding amount |
| `dgii_tipo_ingreso` | text | Income type code (01-06) for sales |
| `dgii_tipo_anulacion` | text | Cancellation reason code (01-10) for voided NCFs |
| `transaction_direction` | text | 'purchase' or 'sale' to distinguish 606 vs 607 entries (default: 'purchase') |

## UI Changes

### 1. Transaction Form Updates

- Add optional "Tipo Bienes/Servicios" dropdown (DGII codes 01-13) visible when entering purchases
- Add optional "ITBIS Retenido" and "ISR Retenido" number fields
- Add "Tipo de Ingreso" dropdown (codes 01-06) visible when entering sales
- When voiding a transaction, show a "Tipo de Anulacion" dropdown (codes 01-10)

### 2. New DGII Reports Tab in Accounting

Add a fourth tab "DGII" to the Accounting page (next to Informes, Activos Fijos, Diario). It will contain:

- **Period selector**: Month/Year picker to select reporting period
- **Three sub-tabs**: 606, 607, 608
- Each sub-tab shows a table matching the exact DGII Excel template columns
- **Export to Excel** button that generates a file matching the DGII template format
- **Copy All** button to copy table data to clipboard for pasting

### 3. DGII 606 Table Columns (Compras)

| Column | Source |
|---|---|
| RNC / Cedula | `transactions.rnc` |
| Tipo Id | Derived from RNC length (1=RNC, 2=Cedula) |
| Tipo Bienes y Servicios | `transactions.dgii_tipo_bienes_servicios` |
| NCF | `transactions.document` |
| Fecha Comprobante | `transactions.transaction_date` |
| Monto Facturado | `transactions.amount` |
| ITBIS Facturado | `transactions.itbis` |
| ITBIS Retenido | `transactions.itbis_retenido` |
| ISR Retenido | `transactions.isr_retenido` |
| Forma de Pago | Mapped from `pay_method` to DGII codes (01-10) |

### 4. DGII 607 Table Columns (Ventas)

| Column | Source |
|---|---|
| RNC / Cedula del Comprador | `transactions.rnc` |
| Tipo Id | Derived from RNC length |
| NCF | `transactions.document` |
| Fecha Comprobante | `transactions.transaction_date` |
| Tipo de Ingreso | `transactions.dgii_tipo_ingreso` |
| Monto Facturado | `transactions.amount` |
| ITBIS Facturado | `transactions.itbis` |
| ITBIS Retenido por Terceros | `transactions.itbis_retenido` |
| ISR Retenido por Terceros | `transactions.isr_retenido` |

### 5. DGII 608 Table Columns (Anulados)

| Column | Source |
|---|---|
| NCF | `transactions.document` |
| Fecha Comprobante | `transactions.transaction_date` |
| Tipo de Anulacion | `transactions.dgii_tipo_anulacion` |

## Technical Details

### New Files
- `src/components/accounting/DGIIReportsView.tsx` -- Main container with month picker and 606/607/608 sub-tabs
- `src/components/accounting/DGII606Table.tsx` -- 606 table and export
- `src/components/accounting/DGII607Table.tsx` -- 607 table and export
- `src/components/accounting/DGII608Table.tsx` -- 608 table and export
- `src/components/accounting/dgiiConstants.ts` -- DGII code mappings (tipo bienes, tipo ingreso, tipo anulacion, forma de pago)

### Modified Files
- `src/pages/Accounting.tsx` -- Add "DGII" tab
- `src/components/transactions/TransactionForm.tsx` -- Add new DGII fields
- `src/contexts/LanguageContext.tsx` -- Add translation keys for DGII labels
- Database migration for new columns

### Pay Method Mapping to DGII Codes
- `cash` -> 01 (Efectivo)
- `transfer_bdi` / `transfer_bhd` / `Transfer BHD` -> 02 (Cheques/Transferencias)
- `cc_management` -> 04 (Tarjeta de Credito)
- Others -> 06 (Bonos o Certificados de Regalo) or custom mapping

### Existing Data
- 157 transactions total, 149 with NCF, 51 with RNC -- most data is already in place
- New DGII-specific fields will default to null and can be filled in retroactively or going forward

