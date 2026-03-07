

## Fix: Budget amounts showing 3 decimal places instead of 0

### Problem
Exchange rate conversions produce fractional results (e.g., `1234.567`). The `toLocaleString` calls use `minimumFractionDigits: 2` but don't cap `maximumFractionDigits`, so JS shows up to 3 digits.

### Solution
Add `maximumFractionDigits: 0` and change `minimumFractionDigits: 0` across all ~10 `toLocaleString` calls in `BudgetGrid.tsx` so budget values display as whole numbers (no decimals).

Also round the actual values at computation time (`Math.round`) to avoid any floating-point display issues downstream.

### Files changed
- `src/components/budget/BudgetGrid.tsx` — update all `toLocaleString` formatting calls to `{ minimumFractionDigits: 0, maximumFractionDigits: 0 }`

