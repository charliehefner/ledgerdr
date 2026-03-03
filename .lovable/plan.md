

## Day Labor Receipts — Implementation Plan

### Overview
Create individual payment receipts for day laborers (matching the payroll receipt style), with smart task grouping, case-insensitive matching, and available for both open and closed weeks.

---

### New File: `src/lib/dayLaborReceipts.ts`

**Purpose**: Generate two-up PDF receipts (company + worker copy) bundled in a ZIP.

**Receipt layout** (mirrors `payrollReceipts.ts`):
- **Header**: "RECIBO DE JORNAL" + week label + period dates
- **Worker info box**: Full name + cédula (from `jornaleros` table, matched case-insensitively)
- **Task table**: Entries grouped by `operation_description` (case-insensitive):
  - Same description on multiple dates → collapsed into one row with date range (e.g., "12/01 – 16/01") and summed amount
  - Unique description → single date shown
- **Total box**: Grey background with white text (greyscale for ink conservation)
- **Signature lines**: "Firma del Trabajador" + "Firma Autorizada"
- **Two-up layout**: Company copy on top, dashed cut line, worker copy on bottom

**Exported function**: `generateDayLaborReceiptsZip(workerGroups, jornaleros, weekFriday, weekStart, weekEnd)`
- Builds a `Map<lowercaseName, cedula>` for case-insensitive lookup
- Iterates worker groups, generates one PDF per worker, bundles all into ZIP
- Filename: `Recibos_Jornal_YYYY-MM-DD.zip`

---

### Modified File: `src/components/hr/DayLaborView.tsx`

1. **Import** `generateDayLaborReceiptsZip` from the new utility

2. **Add "Recibos" menu item** to the existing Export dropdown (after the PDF and Excel items):
   ```
   <DropdownMenuItem onClick={generateReceipts}>
     <FileDown className="mr-2 h-4 w-4" />
     Descargar Recibos
   </DropdownMenuItem>
   ```

3. **`generateReceipts` handler**: Calls `generateDayLaborReceiptsZip(summaryByWorker, jornaleros, selectedFriday, weekStart, weekEnd)` — works for both open and closed weeks since it reads from the existing `entries` data.

4. **Auto-generate on week close**: Add `generateDayLaborReceiptsZip(...)` call inside the `closeWeek` mutation (after `generatePDF()`), so receipts are automatically downloaded alongside the summary when closing a week.

5. **Available for closed periods**: The "Descargar Recibos" button in the export menu is **not** gated by `isWeekClosed` — it works on any week with entries, whether open or closed. This lets users regenerate receipts for past closed weeks.

---

### Technical Details

- **Case-insensitive task grouping**: `key = operation_description.trim().toLowerCase()`
- **Case-insensitive worker-jornalero matching**: `jornaleros.find(j => j.name.trim().toLowerCase() === workerName.trim().toLowerCase())`
- **Date collapsing logic**: Group entries by normalized description, collect unique dates, sort them, show first–last as range if >1 date
- No database changes needed — all data already exists in `day_labor_entries` and `jornaleros` tables

