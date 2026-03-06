

## Visual Enhancement: Accounting Page

### Current Issues (from screenshot)
- Page header is plain text, no visual weight or branding
- Tab bar floats without visual grounding — no container or separator
- Report selector + Power BI button sit loosely below tabs with no grouping
- Empty state is visually sparse — icon is small and grey, lots of dead space
- No cards or visual containers to create sections
- The overall layout feels like a prototype, not a finished product

### Plan

**1. Page Header Enhancement (`src/pages/Accounting.tsx`)**
- Wrap the title area in a subtle gradient card with an icon (e.g., `BookOpen` or the existing accounting icon)
- Add a colored left border accent to the header for visual weight

**2. Tab Bar Styling (`src/pages/Accounting.tsx` or `TabbedPageLayout`)**
- Add a bottom border/divider below the tab bar to visually separate navigation from content
- Consider adding small icons next to each tab label (BarChart3, Building2, BookOpen, RotateCcw, Calendar, FileText, Shield)

**3. Report Selector Area (`AccountingReportsView.tsx`)**
- Wrap the report type selector + Power BI button in a card/toolbar container with subtle background
- Add a label above the selector ("Tipo de Informe")
- Give the Power BI button a distinct secondary style so it doesn't compete with the selector

**4. Empty State Upgrade (`AccountingReportsView.tsx`)**
- Use a larger, colored icon (primary color instead of grey)
- Add a subtle background pattern or gradient to the empty state area
- Wrap in a card with dashed border for visual definition
- Add a brief list of available report types as secondary info

**5. Content Area Container**
- When reports load, wrap the table/chart content in a Card component for visual containment
- Add consistent padding and spacing

### Files to Edit
| File | Changes |
|------|---------|
| `src/pages/Accounting.tsx` | Add icons to tab labels, header accent |
| `src/components/accounting/AccountingReportsView.tsx` | Toolbar card, enhanced empty state, content card wrapping |
| `src/components/layout/TabbedPageLayout.tsx` | Add bottom border to tab bar, optional header card styling |

All changes are CSS/className and minor JSX — no logic or data changes.

