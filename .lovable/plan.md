

# Add Accounting Periods Tab

## Problem
The `PeriodsView` component (for creating/managing accounting periods) already exists in the codebase but is not connected to the Accounting module's tab navigation. There is no way to access it from the UI.

## Solution
Add a new **"Periodos"** (Periods) tab to the Accounting page, placed between the Journal and DGII tabs since periods are closely related to journal workflow.

## Technical Changes

### File: `src/pages/Accounting.tsx`
- Import `PeriodsView` from `@/components/accounting/PeriodsView`
- Add a new tab entry with value `"periods"` and label `"Periodos"` after the Journal tab

### File: `src/contexts/LanguageContext.tsx`
- Add translation key `accounting.periods` with values:
  - ES: "Periodos"
  - EN: "Periods"

## Result
After this change, you will see a **Periodos** tab in the Accounting module where you can create accounting periods (e.g., "Enero 2026"), set start/end dates, and open/close them before generating journal entries.
