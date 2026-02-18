

# IT-1: Declaracion Mensual de ITBIS

## What is the IT-1?

The IT-1 is the monthly ITBIS (VAT) declaration form filed on the DGII portal. It calculates the net ITBIS to pay (or carry forward) based on:

- **ITBIS Cobrado** (collected): ITBIS from sales (607 transactions)
- **ITBIS Pagado** (paid): ITBIS from purchases (606 transactions)
- **ITBIS Retenido por Terceros**: ITBIS withheld by third parties on your sales (if any)
- **Saldo a favor anterior**: Carry-forward credit from prior months (manual entry)

The formula: **ITBIS a Pagar = ITBIS Cobrado - ITBIS Pagado - Saldo Anterior**

If the result is negative, it becomes a "saldo a favor" (credit) to carry to the next month.

## Where It Fits

This belongs in the **Accounting module's DGII tab**, right alongside the existing 606/607/608 reports since it uses the exact same data. A new sub-tab "IT-1" will be added.

## Data Sources (Already Available)

All data already exists in the `transactions` table:

| Source | Filter | Field |
|---|---|---|
| ITBIS Cobrado | `transaction_direction = 'sale'`, not void | `itbis` column |
| ITBIS Pagado | `transaction_direction = 'purchase'` (or null), not void | `itbis` column |
| ITBIS Retenido a terceros | Same purchases | `itbis_retenido` column |

No database changes required.

## Report Layout

The IT-1 report card will display:

```text
+--------------------------------------------------+
| IT-1 - ITBIS Mensual          [Mes] [Ano]        |
+--------------------------------------------------+
| Seccion I: Operaciones                            |
|   Total Ventas Gravadas .......... RD$ XXX,XXX.XX |
|   ITBIS Cobrado .................. RD$  XX,XXX.XX |
|                                                    |
| Seccion II: Deducciones                           |
|   Total Compras con ITBIS ........ RD$ XXX,XXX.XX |
|   ITBIS Pagado en Compras ........ RD$  XX,XXX.XX |
|   ITBIS Retenido por Terceros .... RD$      XX.XX |
|   Saldo a Favor Anterior ......... RD$       0.00 | <-- manual input
|   Total Deducciones .............. RD$  XX,XXX.XX |
|                                                    |
| Resultado                                         |
|   ITBIS a Pagar / (Saldo a Favor) RD$   X,XXX.XX |
+--------------------------------------------------+
| [Copiar Total]  [Exportar Excel]                  |
+--------------------------------------------------+
```

## Technical Changes

| File | Change |
|---|---|
| `src/components/accounting/IT1ReportView.tsx` | **New** -- IT-1 summary component |
| `src/components/accounting/DGIIReportsView.tsx` | Add "IT-1" as a 4th sub-tab alongside 606, 607, 608 |

### IT1ReportView Implementation

- Reuses the same month/year selector already passed from `DGIIReportsView`
- Receives `purchases` and `sales` arrays already fetched by the parent (no extra queries)
- Calculates:
  - `totalVentasGravadas`: sum of `amount` from sales where `itbis > 0`
  - `itbisCobrado`: sum of `itbis` from sales
  - `totalComprasConItbis`: sum of `amount` from purchases where `itbis > 0`
  - `itbisPagado`: sum of `itbis` from purchases
  - `itbisRetenidoTerceros`: sum of `itbis_retenido` from purchases
  - `saldoAnterior`: manual input field (default 0)
  - `resultado`: `itbisCobrado - itbisPagado - itbisRetenidoTerceros - saldoAnterior`
- "Copy Total" and "Export Excel" buttons following existing patterns
- Summary display matching DGII IT-1 form sections for easy portal entry

### Parent Changes (DGIIReportsView)

- Add a 4th tab trigger: `IT-1 - ITBIS`
- Pass existing `purchases` and `sales` data to `IT1ReportView` as props (zero extra queries)

