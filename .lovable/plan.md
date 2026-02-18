

# Bilingual Info Tooltips

## Overview

Add a reusable `InfoTooltip` component (a "?" icon showing help text on hover) with all tooltip texts registered in the existing `LanguageContext` translation system, so they automatically follow the language toggle.

## New Component

**`src/components/ui/info-tooltip.tsx`**

A small wrapper: `HelpCircle` icon (14px, `text-muted-foreground`) inside a Radix Tooltip. Accepts a translation key string and calls `t(key)` internally to resolve the correct language.

## Translation Keys

Added to both `es` and `en` blocks in `src/contexts/LanguageContext.tsx`:

| Key | Spanish | English |
|---|---|---|
| `help.generateJournals` | Crea asientos contables automaticamente a partir de transacciones sin asiento vinculado. Se generan en estado Borrador para revision. | Automatically creates journal entries from transactions without a linked entry. Generated as Draft for review. |
| `help.dgii606` | Reporte de compras y gastos con comprobantes fiscales. Se sube como archivo .txt al portal de la DGII cada mes. | Purchase and expense report with fiscal receipts. Uploaded as a .txt file to the DGII portal monthly. |
| `help.dgii607` | Reporte de ventas con comprobantes fiscales. Se sube como archivo .txt al portal de la DGII cada mes. | Sales report with fiscal receipts. Uploaded as a .txt file to the DGII portal monthly. |
| `help.dgii608` | Reporte de comprobantes fiscales anulados durante el mes. Se sube como archivo .txt al portal de la DGII. | Report of voided fiscal receipts during the month. Uploaded as a .txt file to the DGII portal. |
| `help.it1` | Calcula el ITBIS neto a pagar o saldo a favor del mes. Los valores se copian manualmente al formulario IT-1 en el portal de la DGII. | Calculates the net ITBIS to pay or credit balance for the month. Values are manually copied to the IT-1 form on the DGII portal. |
| `help.tss` | Genera el archivo .txt de Autodeterminacion Mensual para cargar al sistema SUIRPLUS de la TSS. Incluye todos los empleados activos con sus salarios. | Generates the Monthly Self-Assessment .txt file to upload to the TSS SUIRPLUS system. Includes all active employees with their salaries. |
| `help.ir3` | Retencion mensual del ISR sobre salarios. Los valores se ingresan manualmente en el formulario IR-3 del portal de la DGII. | Monthly ISR withholding on salaries. Values are manually entered in the IR-3 form on the DGII portal. |
| `help.ir17` | Declaracion del impuesto complementario sobre retribuciones complementarias. Se ingresa manualmente en el formulario IR-17 de la DGII. | Complementary tax declaration on supplementary compensation. Manually entered in the IR-17 form on the DGII portal. |

## Files Modified

| File | Change |
|---|---|
| `src/components/ui/info-tooltip.tsx` | **New** -- reusable component, calls `useLanguage().t(key)` |
| `src/contexts/LanguageContext.tsx` | Add 8 new keys to both `es` and `en` translation blocks |
| `src/components/accounting/JournalView.tsx` | Add `InfoTooltip` next to "Generar Asientos" button |
| `src/components/accounting/DGIIReportsView.tsx` | Add `InfoTooltip` next to each tab label (606, 607, 608, IT-1) |
| `src/components/hr/TSSAutodeterminacionView.tsx` | Add `InfoTooltip` next to the card title |
| `src/components/hr/IR3ReportView.tsx` | Add `InfoTooltip` next to the card title |
| `src/components/hr/IR17ReportView.tsx` | Add `InfoTooltip` next to the card title |

