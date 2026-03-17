

# Redesign Accounting Reports as 6-Card Grid

## Current State
The Reports tab uses a dropdown selector to switch between 6 report types (Transaction Detail, P&L, Balance Sheet, Trial Balance, Aging, Cash Flow). When "detail" is selected, an empty state with quick-action buttons appears. The Power BI export button sits in the toolbar next to the dropdown.

## Proposed Design
Replace the dropdown + empty state with a **6-card grid landing page**. Each card is a clickable report entry point with an icon, title, and brief description. Once a card is clicked, the corresponding report view renders (same as today). A back button returns to the grid.

### Card Grid Layout
3 columns on desktop, 2 on tablet, 1 on mobile. Cards follow the existing enterprise design system (soft shadows, hover elevation, left-border accent).

```text
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  📊 Profit &     │  │  📋 Balance      │  │  ⚖️ Trial        │
│     Loss         │  │     Sheet        │  │     Balance      │
│  Income vs       │  │  Assets, liab,   │  │  Verify debit =  │
│  expenses        │  │  equity snapshot  │  │  credit totals   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  💰 Cash Flow    │  │  ⏳ Aging        │  │  📑 Transaction  │
│                  │  │     Report       │  │     Reports      │
│  Operating,      │  │  Outstanding     │  │  Filterable      │
│  investing, fin  │  │  balances by age │  │  detail report   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Power BI Export Placement
The **Export Power BI** button moves to the top-right of the grid landing page as a secondary action (consistent with how export buttons appear elsewhere in the app). It's visible without being intrusive.

## Implementation

### File: `src/components/accounting/AccountingReportsView.tsx`
1. **Remove** the toolbar card with the `<Select>` dropdown (lines 384–405).
2. **Add a grid landing page** when `reportType` is `null` (change initial state from `"detail"` to `null`). The grid renders 6 styled cards, each with an icon, translated title, translated subtitle, and `onClick` to set reportType.
3. **Rename** "Transaction Detail" → "Transaction Reports" (add new i18n key `acctReport.transactionReports` / `acctReport.transactionReportsDesc`).
4. **Add a back/return button** at the top of each report view to go back to the grid (`setReportType(null)`).
5. **Place Power BI button** in the grid header row (top-right, aligned with a section title like "Accounting Reports").
6. Update `ReportType` to allow `null` as the landing state.

### Files: `src/i18n/en.ts` and `src/i18n/es.ts`
Add ~8 new keys:
- `acctReport.transactionReports` — "Transaction Reports" / "Informes de Transacciones"
- `acctReport.transactionReportsDesc` — short description
- `acctReport.plDesc`, `acctReport.bsDesc`, `acctReport.tbDesc`, `acctReport.cfDesc`, `acctReport.agingDesc` — card subtitles
- `acctReport.backToReports` — "Back to Reports" / "Volver a Informes"

### Scope
3 files changed. No database changes. All existing report functionality preserved — only the navigation entry point changes.

