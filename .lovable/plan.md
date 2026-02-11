

## Improve Payroll Receipts: Loan Details + Greyscale

### 1. Loan Line Items with Details

**Current state:** The receipt shows a single line "Prestamo" with the total deduction amount. The `PayrollData` interface only has `loanDeduction: number` -- no detail about individual loans.

**Change:** Replace the single loan line with one line per active loan showing: `"Prestamo de $XX,XXX, parcela X de Y"`

**Files to change:**

**`src/lib/payrollReceipts.ts`**
- Add a `LoanDetail` interface: `{ loan_amount: number; payment_amount: number; payment_number: number; total_payments: number }`
- Add `loanDetails: LoanDetail[]` to the `PayrollData` interface (keeping `loanDeduction` for the total)
- In the deductions section, replace the single "Prestamo" line with a loop over `loanDetails`, rendering each as:
  `Prestamo de RD$15,000, parcela 3 de 6 .......... RD$2,500.00`

**`src/components/hr/PayrollSummary.tsx`**
- When building the payroll data array, also include `total_payments` in the loan query (need to compute it from `loan_amount / payment_amount`)
- For each employee, map their active loans into `loanDetails` with the current payment number (`total_payments - remaining_payments + 1`) and total payments
- Pass `loanDetails` alongside the existing `loanDeduction` total

### 2. Convert to Greyscale (Ink-Saving)

**Current state:** The receipt uses colored fills:
- Earnings header: green `(232, 245, 233)`
- Deductions header: red `(255, 235, 238)`
- Net pay box: blue `(33, 150, 243)` with white text
- Colored separator lines (green, red)
- Employee box: light grey (already fine)

**Change:** Replace all colors with greyscale tones:
- Earnings header: light grey `(235, 235, 235)`
- Deductions header: light grey `(235, 235, 235)`
- Net pay box: dark grey `(80, 80, 80)` with white text
- Separator lines: medium grey `(150, 150, 150)`
- Keep employee details box as-is (already light grey)

This preserves visual hierarchy while using minimal ink.

### Summary of Changes

| File | Change |
|------|--------|
| `src/lib/payrollReceipts.ts` | Add `LoanDetail` interface, update `PayrollData`, render per-loan lines, convert all colors to greyscale |
| `src/components/hr/PayrollSummary.tsx` | Compute `loanDetails` array with payment numbers and pass to receipt data |

