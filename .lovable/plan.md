# DGII 606 — Full Column Coverage Audit

## What the official format requires (23 columns)

From DGII's `Formato-de-Envio-606` (NG 07-2018 / 05-2019):

| # | Column | Currently exported? | Source today | Gap / action |
|---|--------|--------------------|--------------|--------------|
| 1 | RNC o Cédula | Yes | `transactions.rnc` | OK |
| 2 | Tipo Id | Yes | Derived from RNC length | OK |
| 3 | Tipo Bienes y Servicios Comprados | Yes | `transactions.dgii_tipo_bienes_servicios` | OK |
| 4 | NCF | Yes | `transactions.document` | OK |
| 5 | NCF o Documento Modificado | **No** (always blank) | — | **Add field** on transaction (only used for credit/debit notes referencing original NCF) |
| 6 | Fecha Comprobante | Yes | `transaction_date` | OK |
| 7 | Fecha Pago | Yes | `purchase_date` fallback `transaction_date` | OK — verify semantics (should be actual payment date, not purchase date) |
| 8 | **Monto Facturado en Servicios** | **No** (lumped) | — | **Split needed** |
| 9 | **Monto Facturado en Bienes** | **No** (lumped) | — | **Split needed** |
| 10 | Total Monto Facturado | Yes (computed `amount − itbis`) | derived | OK once 8+9 exist (= 8+9) |
| 11 | ITBIS Facturado | Yes | `transactions.itbis` | OK |
| 12 | ITBIS Retenido | Yes | `transactions.itbis_retenido` | OK |
| 13 | **ITBIS sujeto a Proporcionalidad (Art. 349)** | No | — | **New field** (rare; usually 0) |
| 14 | **ITBIS llevado al Costo** | No | — | **New field** (rare; usually 0) |
| 15 | **ITBIS por Adelantar** | No | — | **New field** — typically = ITBIS Facturado − cost − proporcionalidad. Can be derived |
| 16 | **ITBIS percibido en compras** | No | — | **New field** (rare; usually 0) |
| 17 | **Tipo de Retención en ISR** | No | — | **New field**, code list (01–11). Required when there is ISR retenido |
| 18 | Monto Retención Renta (ISR) | Yes | `transactions.isr_retenido` | OK |
| 19 | **ISR Percibido en compras** | No | — | **New field** (rare; usually 0) |
| 20 | **Impuesto Selectivo al Consumo (ISC)** | No | — | **New field** (combustibles, telecom, alcohol, tabaco) |
| 21 | **Otros Impuestos / Tasas** | No | — | **New field** (CDT, propina obligatoria-no-legal, etc.) |
| 22 | **Monto Propina Legal (10%)** | No | — | **New field** (restaurants) |
| 23 | Forma de Pago | Yes | `pay_method` → DGII code | OK |

## Summary of gaps

**11 of 23 columns** are missing from the export. They fall into three buckets:

### A. Almost always needed (high priority)
- **Col 5 — NCF Modificado**: required for any debit/credit note (NCF tipo B04/B03). Currently we never emit it.
- **Col 8 / 9 — Servicios vs Bienes split**: every line must place its `monto facturado` in one or the other. Today we put the full amount in a single column that doesn't exist in the format (we use it as if it were col 10).
- **Col 17 — Tipo de Retención ISR**: mandatory whenever col 18 (ISR retenido) > 0. Current B11 flow sets ISR retenido but never tags the retention type.

### B. Situational but real (medium priority)
- **Col 20 — ISC**: needed for fuel/telecom/alcohol invoices. Dallasagro buys diesel, so this is relevant.
- **Col 22 — Propina Legal**: needed for any restaurant/representation invoice.
- **Col 21 — Otros Impuestos/Tasas**: occasional.

### C. Rare for an agro entity (low priority, can default to 0)
- Col 13 ITBIS Proporcionalidad (Art. 349)
- Col 14 ITBIS al Costo
- Col 15 ITBIS por Adelantar (can be derived: `itbis − col13 − col14`)
- Col 16 ITBIS percibido en compras
- Col 19 ISR percibido en compras

## Where the new inputs should live

Two reasonable approaches:

1. **Inline on the transaction form**: add an expandable "DGII 606 detalle" section (collapsed by default) on `TransactionForm.tsx` for purchase-type rows. Fields: bienes/servicios split (radio + amount or two amounts), NCF modificado, tipo retención ISR, ISC, propina legal, otros impuestos, ITBIS al costo / proporcionalidad / adelantar.
2. **Secondary "606 enrichment" screen** inside `DGIIReportsView`: a per-row editable grid where the accountant can fill the extra fields just before exporting. Stored back on the transaction.

Recommendation: do **(1)** for the 3 high-priority fields (default servicios=full, NCF mod blank, tipo ret ISR auto when B11) and **(2)** for the rest, so daily entry isn't slowed down.

## Technical changes (for the implementation step)

- **DB**: add columns to `transactions`:
  - `ncf_modificado text`
  - `monto_bienes numeric` (nullable; if null & monto_servicios null, treat full as servicios or bienes by account class)
  - `monto_servicios numeric`
  - `dgii_tipo_retencion_isr text` (code 01–11)
  - `isc numeric default 0`
  - `propina_legal numeric default 0`
  - `otros_impuestos numeric default 0`
  - `itbis_proporcionalidad numeric default 0`
  - `itbis_al_costo numeric default 0`
  - `itbis_percibido numeric default 0`
  - `isr_percibido numeric default 0`
- **Backend**: update `generate_dgii_606` RPC to emit all 23 fields in the fixed order with `|` separator (TXT) and matching Excel columns.
- **Frontend**:
  - Extend `DGII606Table.tsx` columns + Excel export to all 23.
  - Add inputs to `TransactionForm.tsx` (high-priority subset) and an editable grid in `DGIIReportsView.tsx` for the rest.
  - Add `TIPO_RETENCION_ISR` code map to `dgiiConstants.ts`.
- **Defaults / heuristics** to minimize manual entry:
  - If account is a service account (e.g. honorarios, alquiler, servicios) → default to `monto_servicios = total - itbis`; else `monto_bienes`.
  - If `pay_method = B11` flow and `isr_retenido > 0` → default `tipo_retencion_isr = '02'` (Honorarios) or by account.
  - `itbis_por_adelantar = itbis − proporcionalidad − al_costo` when others are zero.

## Open questions for you before we build

1. Inline form vs. enrichment grid vs. both — which workflow do you prefer?
2. For the bienes/servicios split, is a **per-account default** (mark each Chart-of-Accounts entry as "bien" or "servicio") acceptable, so the user almost never has to choose manually?
3. Should we backfill the new columns for existing transactions (using account-based defaults), or leave historical rows blank and only enforce going forward?
