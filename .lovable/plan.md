

## Restructure Budget P&L to Match Corporate Template

### Overview
Replace the flat list of expense accounts in the P&L budget tab with a grouped, sectioned layout matching the uploaded Excel template. Accounts will be grouped by their code ranges into P&L sections with subtotal and computed rows.

### Account-to-Section Mapping

```text
Section                          Account Range    Sign
─────────────────────────────────────────────────────
Net Sales                        30xx–39xx        +
  → Total Revenue (subtotal)
Raw material & Consumables       40xx–49xx        −
Other external cost              50xx–69xx        −
Personnel cost                   70xx–76xx        −
Amortisation/depreciation        77xx–79xx        −
  → Total Cost (subtotal)
  → Operating Profit (Loss) = Revenue − Cost

Other interest income            80xx–83xx INCOME +
Interest expense                 80xx–84xx EXPENSE−
Realized exchange diff           (future/manual)
Unrealized exchange diff         (future/manual)
  → Total Financial Items
  → Profit after Financial Items

Total Appropriations             85xx             −
  → Profit before Tax

Company Tax                      89xx             −
  → Net Profit (Loss)
```

### Changes

**`src/components/budget/BudgetGrid.tsx`**
- Define a `PL_SECTIONS` config array with `{ key, label_en, label_es, codeRange, sign, isSubtotal?, isComputed? }`
- When `budgetType === "pl"`, fetch ALL income + expense accounts (not just expense)
- Group fetched accounts into sections by code prefix
- Render each section:
  - **Section header row** (bold, shaded) — non-editable label
  - **Account rows** within the section — editable budget/forecast/months as today
  - **Subtotal rows** (e.g. "Total Revenue", "Total Cost") — computed, non-editable, bold
  - **Computed rows** (e.g. "Operating Profit") — derived from subtotals above, bold with distinct styling
- Keep existing editable inputs for individual account lines
- Keep the "Actual" column logic with drill-down
- Annual (year total) column shows sum of months, matching the Excel's `2026` column
- Columns: Label | Annual | Jan–Dec (drop Budget/Forecast/Actual/ToDistribute for P&L view to match template; or keep them — will confirm with existing data)

**Actually** — to minimize disruption, keep the existing column structure (Budget, Forecast, Actual, ToDistribute, months) but add the sectioned row grouping. The Excel template is an *input* format; the app grid can retain its richer columns while adopting the row structure.

**`src/i18n/en.ts` and `src/i18n/es.ts`**
- Add labels for each P&L section: `budget.section.netSales`, `budget.section.totalRevenue`, `budget.section.rawMaterial`, `budget.section.otherExternal`, `budget.section.personnelCost`, `budget.section.depreciation`, `budget.section.totalCost`, `budget.section.operatingProfit`, `budget.section.interestIncome`, `budget.section.interestExpense`, `budget.section.realizedFx`, `budget.section.unrealizedFx`, `budget.section.totalFinancial`, `budget.section.profitAfterFinancial`, `budget.section.appropriations`, `budget.section.totalAppropriations`, `budget.section.companyTax`, `budget.section.totalTaxes`, `budget.section.netProfit`

### Key Behaviors
- Section headers and subtotals are **not editable** — they aggregate child rows
- Empty sections (no accounts with data) still show header + subtotal with zeros
- Computed rows (Operating Profit, Net Profit) derive from subtotals above
- Revenue accounts shown with positive sign, cost accounts negative (matching "Enter revenue positive and cost negative")
- Project tabs remain unchanged (flat CBS code list)

