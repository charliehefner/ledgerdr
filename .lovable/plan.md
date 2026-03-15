

## Account Visibility Selector + Sticky Header for Budget Grid

### What it does
Adds a multi-select dialog (using the existing `ColumnSelector` pattern) that lets you hide/show individual accounts without deleting them. Hidden accounts are remembered in localStorage. The header row becomes sticky so it stays visible when scrolling vertically. The Code/Description column continues to auto-fit.

### Changes

**File: `src/components/budget/BudgetGrid.tsx`**

1. **Account visibility state** — Add a `Set<string>` of hidden account codes, persisted to `localStorage` under key `budget-hidden-accounts-{budgetType}-{fiscalYear}`. Initialize empty (all visible).

2. **Filter accounts before rendering** — In `renderPLBody`, filter `plData.sectionAccounts[section.key]` to exclude hidden codes. In `renderProjectBody`, filter `lineCodes`. Subtotals/computed rows still use ALL accounts (so totals remain correct even when accounts are hidden).

3. **Account selector UI** — Add a button (using `Settings2` icon, like the existing `ColumnSelector`) next to the Export button. Opens a `Dialog` with:
   - Grouped by P&L section (for `pl` type) or flat list (for `project` type)
   - Checkboxes for each account (code + description)
   - "Select All" / "Deselect All" buttons
   - "Reset" to show all
   - ScrollArea for the list

4. **Sticky header** — Add `sticky top-0` to the `<thead>` element so the header row stays fixed during vertical scroll. The outer `div` already has `overflow-x-auto`; add `overflow-y-auto max-h-[75vh]` to enable vertical scrolling within bounds.

5. **Auto-adjust column** — Already working with `w-max` and `whitespace-nowrap`. No changes needed.

### Technical details

- Hidden accounts stored as `JSON.stringify(Array.from(hiddenSet))` in localStorage
- Key: `budget-hidden-accounts-${budgetType}-${fiscalYear}`
- Subtotals/aggregates always computed from full dataset — hiding is display-only
- New component `AccountSelector` defined inline or extracted to `src/components/budget/AccountSelector.tsx`
- Sticky header: `<thead className="sticky top-0 z-40">` with the container div getting `overflow-y-auto max-h-[75vh]`

