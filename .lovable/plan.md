

## Plan: Budget/Forecast Module

### Database

**New table `budget_lines`:**
- `id` UUID PK
- `budget_type` TEXT NOT NULL (`project` or `pl`)
- `project_code` TEXT (nullable; set for project budgets, null for P/L)
- `fiscal_year` INT NOT NULL (e.g. 2026)
- `line_code` TEXT NOT NULL — CBS code for project budgets, master_acct_code for P/L
- `annual_budget` NUMERIC DEFAULT 0
- `current_forecast` NUMERIC DEFAULT 0
- `month_1` through `month_12` NUMERIC DEFAULT 0 (12 columns, editable forecast by month)
- `created_by` UUID, `created_at`, `updated_at`
- Unique constraint on `(budget_type, project_code, fiscal_year, line_code)`
- RLS: admin, management, accountant can read/write

### Actuals Computation

- **Project budgets:** Query `transactions` where `project_code = X` and `cbs_code = line_code`, sum `amount` for the fiscal year, grouped by CBS code
- **P/L budgets:** Query `transactions` where `master_acct_code = line_code` (expense accounts only, those used in transactions), sum `amount` for the fiscal year

Drill-down icon opens a dialog listing matching transactions: legacy_id, date, name, amount.

### New Files

1. **`src/pages/Budget.tsx`** — `TabbedPageLayout` with one tab per project (from `projects` table) plus a "P/L" tab. Each tab renders `BudgetGrid`.

2. **`src/components/budget/BudgetGrid.tsx`** — The spreadsheet-like component:
   - Fetches `budget_lines` for selected project/PL + fiscal year
   - Fetches row codes: CBS codes (for project) or expense master accounts used in transactions (for P/L)
   - Fetches actuals from `transactions`
   - Layout: horizontally scrollable table with sticky first 5 columns
   - Sticky columns via `position: sticky` + `left` offsets + `z-index` on both `<th>` and `<td>`
   - Col 1: Code + description (from `cbs_codes` or `chart_of_accounts` via `getDescription()`)
   - Col 2: Annual budget — editable `<Input>` that auto-saves on blur
   - Col 3: Current forecast — editable `<Input>`, auto-save on blur
   - Col 4: Actual spent — read-only number + clickable icon opening `ActualDetailDialog`
   - Col 5: Variance = forecast - actual (color-coded: green if positive, red if negative)
   - Cols 6-17: Month 1-12 editable inputs (month_1 through month_12)
   - Year selector in toolbar (default: current year)

3. **`src/components/budget/ActualDetailDialog.tsx`** — Dialog showing list of transactions for a given line code, with columns: ID, Date, Name, Amount.

### Sticky Scroll Implementation

```text
┌──────────────────────────────────┬─────────────────────────────────────────┐
│  STICKY (cols 1-5)               │  SCROLLABLE (cols 6-17: months)         │
│  Code | Budget | Forecast |      │  Ene | Feb | Mar | ... | Dic            │
│       | Actual | Variance |      │                                         │
└──────────────────────────────────┴─────────────────────────────────────────┘
```

Each sticky column gets `className="sticky left-[Xpx] z-20 bg-background"` with cumulative left offsets. The table wrapper has `overflow-x-auto`.

### Routing & Sidebar

- New route `/budget` in `App.tsx`
- New sidebar item "Presupuesto" with `Wallet` icon after Accounting/AP-AR
- New section `"budget"` in `permissions.ts` — accessible to admin, management, accountant

### I18n

Add keys for: `nav.budget`, `page.budget.title`, `page.budget.subtitle`, `budget.annual`, `budget.forecast`, `budget.actual`, `budget.variance`, `budget.pl`, month names, etc.

### Files Touched

| File | Change |
|---|---|
| `budget_lines` migration | New table |
| `src/pages/Budget.tsx` | New page |
| `src/components/budget/BudgetGrid.tsx` | New grid component |
| `src/components/budget/ActualDetailDialog.tsx` | New dialog |
| `src/lib/permissions.ts` | Add `budget` section |
| `src/components/layout/Sidebar.tsx` | Add nav item |
| `src/App.tsx` | Add route |
| `src/i18n/en.ts`, `src/i18n/es.ts` | Add keys |

