

## Comprehensive Rendering Prevention Audit

After scanning 60+ component files across all modules, here are the actionable issues organized by category.

---

### Category 1: NaN / Infinity Display (7 fixes)

These are places where division results can render as "NaN" or "Infinity" in the UI.

**A. `TractorHistoryView.tsx` — line 118**: `tx.hour_meter_reading - (tx.previous_hour_meter || 0)` can produce a negative number when `previous_hour_meter` is greater (data entry error). The consumption rate would be negative. Not NaN, but misleading. Guard `hoursWorked` to `Math.max(0, ...)`.

**B. `TractorHistoryView.tsx` — line 193**: `s.avgConsumption = s.totalHours > 0 ? s.totalGallons / s.totalHours : 0` — safe, but `totalGallons` or `totalHours` could be NaN if `tx.gallons` is null from DB. Guard with `Number(tx.gallons) || 0`.

**C. `FieldProgressReport.tsx` — `percentComplete` calculation**: If the source data produces a `percentComplete` that's NaN (e.g., 0/0 from empty field), `.toFixed()` renders "NaN". Need to verify data source and add `|| 0` guard.

**D. `InputUsageReport.tsx` — line 330**: `amountPerHectare: hectares > 0 ? share / hectares : 0` — safe. But `share` could be NaN if `ft.gallons` is not a number. Already guarded with `Number(ft.gallons) || 0` ✓.

**E. `PayrollSummary.tsx` / `PayrollTimeGrid.tsx`**: Multiple `.toFixed()` calls on computed payroll values. These derive from validated form inputs so risk is low, but `fmtExcel` already handles zero-guard. Low priority.

**F. `BudgetGrid.tsx`**: Variance calculations (budget - actual) — if either is null/undefined, subtraction produces NaN. Need to check.

**G. `FuelTanksView.tsx` — line 296**: `fillPercent.toFixed(0)` — need to verify `fillPercent` can't be NaN (division by capacity that could be 0).

### Category 2: Date Parsing Safety (3 fixes)

**A. `format(new Date(journal.journal_date), ...)` in `JournalDetailDialog.tsx`**: If `journal_date` is null or empty string, `new Date(null)` → "Invalid Date" renders in UI. Same pattern in ~30 files. Most use `+ "T12:00:00"` suffix which is good for timezone, but doesn't guard null.

**Key vulnerable locations** (where the date value comes from a joined/nullable column):
- `JournalDetailDialog.tsx` line 329: `journal.posted_at` — already guarded by `journal.posted_at &&` ✓
- `ScheduledDeletions.tsx` lines 126, 131: `deletion.scheduled_at` / `deletion.execute_after` — these are required columns ✓
- `ServiceProvidersView.tsx` line 344: `s.service_date` — required column ✓

**Most date formatting is safe** because date columns are NOT NULL in the schema. Low risk overall. The main pattern to watch: any date from a LEFT JOIN or nullable column.

**B. `parseDateLocal` (dateUtils.ts)**: If passed `undefined` or `null`, `.split('T')` throws. Add defensive guard.

### Category 3: Missing Empty/Loading/Error States (5 fixes)

Most views handle loading and empty states. The gaps:

**A. `FarmsFieldsView.tsx`**: Has `farmsLoading` and `fieldsLoading` but the rendering doesn't clearly show a loading spinner — just conditionally renders content. Verify.

**B. `ContractedServicesView.tsx`**: No `isLoading` state shown in the UI despite using useQuery.

**C. `BudgetGrid.tsx`**: No loading/empty state visible — if `lineCodes` is empty, the grid renders with just headers. Should show "No budget lines" message.

**D. None of the fuel/operations views handle query `isError`** — if a fetch fails, `isLoading` becomes false and `data` stays as `[]`, so the user sees "No data" instead of an error message. This is a design choice (graceful degradation) but could be confusing.

**E. `FuelTanksView.tsx` line 296**: When a tank has `capacity_gallons = 0` or null, `fillPercent` becomes `Infinity` or `NaN`, and the progress bar breaks.

### Category 4: Overflow / Truncation (2 fixes)

**A. `OperationsLogView.tsx`**: Long notes text in table cells has no truncation — could push table layout.

**B. `ContractDetailReport.tsx`**: Line item descriptions have no max-width constraint.

---

### Prioritized Fix List (13 targeted changes, 6 files)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `dateUtils.ts` | `parseDateLocal(null)` crashes | Early return for falsy input |
| 2 | `TractorHistoryView.tsx` | Negative hours from bad data | `Math.max(0, hoursWorked)` |
| 3 | `TractorHistoryView.tsx` | `tx.gallons` could be null from DB | `Number(tx.gallons) \|\| 0` |
| 4 | `FuelTanksView.tsx` | `fillPercent` NaN/Infinity when capacity=0 | Guard division |
| 5 | `FieldProgressReport.tsx` | `percentComplete` could be NaN | Add `\|\| 0` guard |
| 6 | `BudgetGrid.tsx` | No empty state for zero budget lines | Add empty state message |
| 7 | `BudgetGrid.tsx` | Variance NaN if values null | Guard with `\|\| 0` |
| 8 | `ContractedServicesView.tsx` | No loading state in UI | Add loading indicator |
| 9-13 | Various | Minor: truncation on long text in 2 table views, error state messaging | CSS truncate classes |

### Out of Scope (Already Safe)
- **Index keys**: Most `key={i}` usages are on static/non-reorderable lists (DGII rows, aging buckets, filter badges) — acceptable per React docs.
- **Payroll calculations**: Derive from validated form inputs, low NaN risk.
- **Date formatting**: ~95% of `format(new Date(...))` calls use NOT NULL columns — safe.
- **ReviewStep.tsx**: Already guards division by zero ✓.

