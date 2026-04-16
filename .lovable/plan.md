

## Fix Industrial Tab Slow Load

### Root Cause
All three Industrial sub-views (`PlantHoursView`, `CarretasView`, `TrucksView`) eagerly import `ExcelJS` (~800KB) and `jsPDF` + `jspdf-autotable` (~400KB) at the top level. These libraries are only needed when the user clicks an export button, but they block the initial render of the entire tab.

### Solution
Lazy-load `ExcelJS` and `jsPDF`/`jspdf-autotable` using dynamic `import()` inside the export handler functions, and remove the top-level static imports.

### Changes

**1. `src/components/industrial/PlantHoursView.tsx`**
- Remove top-level `import ExcelJS from "exceljs"` and `import jsPDF` / `import autoTable`
- In the Excel export function, use `const ExcelJS = (await import("exceljs")).default`
- In the PDF export function, use `const jsPDF = (await import("jspdf")).default` and `const autoTable = (await import("jspdf-autotable")).default`

**2. `src/components/industrial/CarretasView.tsx`**
- Same pattern: move ExcelJS/jsPDF to dynamic imports inside export handlers

**3. `src/components/industrial/TrucksView.tsx`**
- Same pattern

### Impact
- Initial load of the Industrial tab drops from ~1.2MB+ of JS parsing down to just the lightweight table/form components
- Export functionality works identically — the libraries load on first export click (typically <1s on any connection)
- No API or schema changes

