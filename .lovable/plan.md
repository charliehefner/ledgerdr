

# Fix Reports UX: Make Report Types More Discoverable

## Problem
The report type dropdown works technically, but the UX makes it hard to discover. The dominant "Generar Informe" button and EmptyState mislead users into thinking that's the only option. The static report type labels at the bottom are not clickable.

## Changes

### `src/components/accounting/AccountingReportsView.tsx`

1. **Make the bottom labels clickable** — Convert the static `<span>` tags (lines 431-435) into `<Button variant="outline" size="sm">` that set `reportType` directly when clicked (e.g., clicking "Estado de Resultados" sets `reportType` to `"pl"`).

2. **Improve visual hierarchy** — Add a brief helper text below the dropdown like "Seleccione un tipo de informe arriba" or make the dropdown more prominent (larger, with an icon).

3. **Change EmptyState description** — Update the text from "Configure los filtros para generar un informe de transacciones" to something like "Seleccione un tipo de informe o configure filtros para el detalle de transacciones" to hint that other report types exist.

This is a minimal, focused fix that makes the existing functionality discoverable without restructuring the page.

