

# Internationalize Hardcoded Spanish Strings in Accounting Module

## Scope

Found hardcoded Spanish strings in **10 accounting files** plus the Accounting page tab label. These need `t()` translation keys added to `src/i18n/en.ts` and `src/i18n/es.ts`, then referenced via `useLanguage()`.

## Files & Strings to Fix

### 1. `src/pages/Accounting.tsx`
- Line 48: `"Recurrentes"` → `t("accounting.recurring")`

### 2. `src/components/accounting/JournalView.tsx`
- "Nuevo Asiento", "asientos encontrados — Mostrando página X de Y", "No hay asientos", empty state description
- Excel export headers (Número, Tipo, Fecha, etc.) and status values (Contabilizado/Borrador)

### 3. `src/components/accounting/JournalEntryForm.tsx`
- "Nuevo Asiento Contable", "Se creará como borrador para revisión", "Creado", "Asiento creado como borrador"
- "Fecha", "Tipo", "Cancelar", "Crear Borrador", "Agregar línea"
- Field labels and placeholders

### 4. `src/components/accounting/JournalDetailDialog.tsx`
- Status badges: "Publicado"/"Borrador", "Aprobado"/"Rechazado"/"Pendiente", "Conciliado"
- "Sin número", "Publicado el", "Tipo de Asiento", "Descripción", "Referencia"
- Journal type labels: "Compras", "Ventas", "Nómina", "Desembolsos", "Recibos"
- Table headers: "Cuenta", "Descripción", "Proyecto", "Débito", "Crédito", "Totales"
- Actions: "Eliminar", "Guardar cambios", "Rechazar", "Aprobar", "Contabilizar"
- Confirm dialogs: "¿Eliminar asiento?", "¿Contabilizar asiento?"

### 5. `src/components/accounting/PeriodsView.tsx`
- STATUS_CONFIG labels: "Abierto"/"Cerrado"/"Reportado"/"Bloqueado"
- "Períodos Contables", "Nuevo Período", empty state text
- Table headers: "Nombre", "Inicio", "Fin", "Estado", "Cambiar Estado", "Cierre", "Revaluación"
- Dialog: "Nuevo Período Contable", "Nombre del Período", "Fecha Inicio", "Fecha Fin"
- Toast messages

### 6. `src/components/accounting/PeriodClosingButton.tsx`
- "Generar Cierre", "Generar Asiento de Cierre", confirmation text, "Generar Borrador"

### 7. `src/components/accounting/PeriodRevaluationButton.tsx`
- "Revaluación", "Revaluación Cambiaria", preview labels, confirmation text

### 8. `src/components/accounting/RecurringEntriesView.tsx`
- "Asientos Recurrentes", "Generar Pendientes", "Nueva Plantilla"
- Table headers and status labels: "Quincenal"/"Mensual", "Activa"/"Inactiva", "Vencida"
- Dialog: "Nueva Plantilla Recurrente", form labels, "Seleccionar cuenta..."
- Toast messages

### 9. `src/components/accounting/ChartOfAccountsView.tsx`
- "Buscar por código o nombre...", "Agregar Cuenta", "Sí"/"No"
- Table headers: "Código", "Nombre", "Tipo", "Moneda", "Posteable"
- Dialog: "Editar Cuenta"/"Nueva Cuenta", form labels
- "Sin padre", "Permite asientos"

### 10. `src/components/accounting/BankReconciliationView.tsx`
- Dialog titles and form labels for bank account and manual line dialogs
- "Cancelar", "Guardando...", "Guardar", "Agregar"
- Status badges: "Conciliada"/"Pendiente", "Crear Entrada"

### 11. `src/components/accounting/TrialBalanceView.tsx`
- "Balanza de Comprobación", "Desde"/"Hasta", "Generar"
- "cuentas", "Exportar", table headers, empty state text

## Implementation

1. **Add ~120 new i18n keys** to both `src/i18n/en.ts` and `src/i18n/es.ts` under an `accounting.*` namespace (e.g., `accounting.newEntry`, `accounting.draft`, `accounting.posted`, `accounting.periods.title`, etc.)

2. **Replace hardcoded strings** in each file with `t("accounting.xxx")` calls. Files that don't already import `useLanguage` will need it added.

3. **Toast messages** will also be translated — they currently show only in Spanish regardless of language setting.

4. Common patterns like "Cancelar", "Guardar", "Eliminar" will reuse existing `common.*` keys where they exist, or new ones will be added.

