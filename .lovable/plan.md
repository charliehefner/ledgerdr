## Context

The card-grid landing in **Contabilidad → Reportes** does already exist in `src/components/accounting/AccountingReportsView.tsx` (lines 400–427) and shows 6 cards: P&L, Balance Sheet, Trial Balance, Cash Flow, Aging, and Transaction Reports. Since you say it isn't appearing the way it used to, I'll treat this as a **visual restoration / upgrade** request — making it more attractive and clearly the entry point, like a "report selector" landing.

## Proposed Changes

### 1. `src/components/accounting/AccountingReportsView.tsx`
Replace the current minimal card grid (lines 407–426) with a richer "selection box" layout:

- **Grouped sections** with subtle headings:
  - **Estados Financieros** — P&L, Balance Sheet, Trial Balance, Cash Flow
  - **Sub-mayores y Detalle** — Aging, Transaction Reports
- **Larger, color-coded cards** (each report gets its own accent color):
  - P&L → emerald, BS → indigo, TB → amber, Cash Flow → sky, Aging → rose, Detail → slate
- **Visual treatment**:
  - 2-column grid on desktop (`md:grid-cols-2`), single column on mobile
  - Larger icons (h-6 w-6) inside a 14×14 rounded tile with the accent color background
  - Title (base font), description (muted, 1–2 lines), and a small "Abrir →" affordance bottom-right
  - Hover: slight lift, accent left-border slides in (already there), subtle ring in the accent color
  - Focus-visible ring for accessibility
- Keep the existing `PowerBIExportButton` in the top-right of the landing
- Preserve all existing logic: `setReportType(card.key)`, BackButton, all sub-views, exports, filter dialog — no behavioral changes

### 2. No new translation keys required
All card titles/descriptions already use existing `t()` keys (`pl.title`, `acctReport.plDesc`, etc.). No `i18n` updates needed.

### 3. No DB / RPC / type changes
Pure presentational change inside one file.

## Files Modified
- `src/components/accounting/AccountingReportsView.tsx` — replace the landing grid block (lines ~400–427) only

## Out of Scope
- The `/analytics` page tabs are unchanged (you confirmed Accounting Reports is the target)
- No changes to ProfitLossView, BalanceSheetView, etc.
- No backend changes
