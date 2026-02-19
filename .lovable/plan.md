

# Restructure P&L into Standard Financial Statement Format

## Problem
The current P&L lists all income and expense accounts in a flat list with just two totals (Total Income, Total Expenses, Net Income). A proper financial statement groups accounts into meaningful categories with intermediate subtotals.

## Proposed Structure

Based on your chart of accounts structure (European-style numbering), the P&L will be reorganized into this standard format:

```text
+--------------------------------------------------+
| ESTADO DE RESULTADOS                             |
| Periodo: 01/01/2025 - 31/12/2025                |
+--------------------------------------------------+
|                                                  |
| INGRESOS OPERACIONALES (30-39)                   |
|   3010  Ventas Skymining nacionales    500,000   |
|   3410  Ventas de servicios             50,000   |
|                         Total Ingresos  550,000  |
|                                                  |
| COSTO DE VENTAS (40-49)                          |
|   4040  Compra de gasoleo               80,000   |
|   4030  Compra de plaguicidas           30,000   |
|                    Total Costo Ventas   110,000  |
|                                                  |
| ============================================     |
| UTILIDAD BRUTA                          440,000  |
| ============================================     |
|                                                  |
| GASTOS OPERACIONALES                             |
|                                                  |
|   Gastos de Local (50-51)                        |
|     5010  Alquiler                      20,000   |
|     5020  Electricidad                   5,000   |
|                           Subtotal      25,000   |
|                                                  |
|   Maquinaria y Equipo (52-53)                    |
|     5210  Alquiler maquinaria           15,000   |
|                           Subtotal      15,000   |
|                                                  |
|   Vehiculos (54)                                 |
|     5410  Combustible vehiculos         10,000   |
|                           Subtotal      10,000   |
|                                                  |
|   Gastos de Personal (60-65)                     |
|     6010  Salarios                     120,000   |
|     6510  Seguro social                 18,000   |
|                           Subtotal     138,000   |
|                                                  |
|   Depreciacion y Amortizacion (69)               |
|     6900  Depreciacion                  30,000   |
|                           Subtotal      30,000   |
|                                                  |
|              Total Gastos Operacionales 218,000  |
|                                                  |
| ============================================     |
| UTILIDAD OPERACIONAL (EBIT)             222,000  |
| ============================================     |
|                                                  |
| OTROS INGRESOS / GASTOS (70-84)                  |
|   7010  Intereses ganados                2,000   |
|   7310  Intereses pagados              (5,000)   |
|                    Total Otros          (3,000)   |
|                                                  |
| ============================================     |
| UTILIDAD NETA                           219,000  |
| ============================================     |
+--------------------------------------------------+
```

## Category Mapping

The account code prefixes map to these P&L sections:

| Prefix | Category (ES) | Category (EN) | Section |
|--------|--------------|---------------|---------|
| 30-39 | Ingresos Operacionales | Operating Revenue | Revenue |
| 40-49 | Costo de Ventas | Cost of Goods Sold | COGS |
| 50-51 | Gastos de Local | Premises Costs | OpEx |
| 52-53 | Maquinaria y Equipo | Machinery & Equipment | OpEx |
| 54 | Vehiculos | Vehicles | OpEx |
| 55-56 | Herramientas y Oficina | Tools & Office | OpEx |
| 57-59 | Administracion y Varios | Admin & Miscellaneous | OpEx |
| 60-65 | Gastos de Personal | Personnel Costs | OpEx |
| 69 | Depreciacion | Depreciation & Amortization | OpEx |
| 70-84 | Otros Ingresos/Gastos | Other Income/Expenses | Financial |
| 89 | Extraordinarios | Extraordinary Items | Financial |

## Key Intermediate Subtotals

1. **Total Ingresos** (Total Revenue)
2. **Utilidad Bruta** = Revenue - COGS (Gross Profit)
3. **Total Gastos Operacionales** (Total Operating Expenses)
4. **Utilidad Operacional (EBIT)** = Gross Profit - Operating Expenses
5. **Utilidad Neta** = EBIT + Other Income/Expenses (Net Income)

## Technical Changes

### File: `src/components/accounting/ProfitLossView.tsx`

- Define a `PL_CATEGORIES` constant array that maps 2-digit prefix ranges to category names (bilingual) and section type (revenue / cogs / opex / financial)
- Replace the current flat `buildRows()` with a `buildCategorizedStatement()` function that:
  - Groups accounts by their prefix into the defined categories
  - Only shows categories that have non-zero balances
  - Calculates subtotals per category
  - Calculates the intermediate totals (Gross Profit, EBIT, Net Income)
- Update the table rendering to show:
  - Section headers (bold, colored background) for Revenue, COGS, OpEx, Financial
  - Category sub-headers (semi-bold) within OpEx
  - Individual account rows indented under their category
  - Category subtotals
  - Highlighted intermediate total rows (Gross Profit, EBIT) with heavier borders
  - Net Income row at bottom with prominent styling
- Update Excel and PDF exports to match the new hierarchical layout with all intermediate totals

### File: `src/contexts/LanguageContext.tsx`

- Add translation keys for new labels: `pl.cogs`, `pl.grossProfit`, `pl.operatingExpenses`, `pl.ebit`, `pl.financialItems`, `pl.premises`, `pl.machinery`, `pl.vehicles`, `pl.toolsOffice`, `pl.admin`, `pl.personnel`, `pl.depreciation`, `pl.extraordinary`

### Balance Sheet
No changes needed -- balance sheet format is already appropriate for its purpose.
