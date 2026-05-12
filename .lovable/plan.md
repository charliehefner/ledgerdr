## Fix Rolando Coca's duplicate "parcela N de M" labels on payroll receipts

### Root cause
The receipt label `parcela N de M` is recomputed live from `employee_loans.remaining_payments` every time a receipt is rendered. Once the next period closes, all earlier reprints shift to the new "current" number — so every reprint of Rolando's Feb–Apr 2026 receipts now reads the same `parcela 6 de 15`. Amounts and discounts (RD$1,000 each) are correct.

### Fix

1. **New table `payroll_loan_deductions`**
   - Columns: `period_id`, `employee_id`, `loan_id`, `payment_number`, `total_payments`, `loan_amount`, `payment_amount`, `entity_id`, timestamps.
   - `UNIQUE (period_id, employee_id, loan_id)` for idempotency.
   - RLS modeled on `payroll_snapshots` (entity-scoped, role-based).

2. **Snapshot at close time**
   - In the close-period RPC, insert one row per active loan **before** decrementing `remaining_payments`, with `payment_number = number_of_payments - remaining_payments + 1`.
   - `ON CONFLICT (period_id, employee_id, loan_id) DO NOTHING`.

3. **Backfill historical periods**
   - For every closed period with `payroll_snapshots.loan_deduction > 0`, assign sequential `payment_number` per (employee, loan) ordered by date, anchored against the loan's current paid count.
   - Rolando's Feb→Apr 2026 receipts will become parcelas **2, 3, 4, 5, 6 of 15** (parcela 1 = pre-system manual deduction noted on the loan).

4. **Read-side change** in `src/components/hr/PayrollSummary.tsx`
   - Fetch `payroll_loan_deductions` for the period being rendered.
   - Replace inline computations at ~line 312 (`buildLegacyData`) and ~line 591 (`snapshotLegacyData`):
     - If a snapshot row exists → use its `payment_number` / `total_payments` / `loan_amount` / `payment_amount`.
     - Else (open preview only) → keep current "next installment" calc.
   - `src/lib/payrollReceipts.ts` already accepts `loanDetails[]` — no change needed; `parcela N de M` labels remain on every receipt as guidance for staff.

### Verification after migration

- Reprint Rolando's Feb/Mar/Apr 2026 receipts → each must show distinct parcelas (2…6 of 15), correct amounts.
- Preview of next open period shows `parcela 7 de 15`.
- Monthly Excel export and ZIP path also pull from snapshot.
- Confirm no other RPC/trigger paths that touch `employee_loans.remaining_payments` were disturbed (loan close, deactivation flow, snapshot total calcs).
- Run security scan after migration; fix anything flagged.

### Out of scope
- No edits to past payroll amounts.
- No restructuring of the loans module.
