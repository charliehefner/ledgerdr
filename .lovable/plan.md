

## Analysis: Net Pay Discrepancy Between Preview and Browser

### Root Cause: `total_deductions` is calculated differently in two places

The unified RPC function and the frontend snapshot-mapping code compute `total_deductions` inconsistently:

**RPC function (line 247):**
```
total_deductions = tss + isr + loan + vacation
```
Absence is NOT included because it's already subtracted inside `gross_pay` (line 169: `gross = base - absence + OT + holiday + sunday + benefits`).

**Frontend snapshot display (PayrollSummary.tsx line 236):**
```typescript
total_deductions: Number(s.tss) + Number(s.isr) + Number(s.absence_deduction)
                + Number(s.vacation_deduction) + Number(s.loan_deduction)
```
This ADDS absence_deduction back into total_deductions for closed/committed periods.

**Result:** When viewing committed snapshots (closed periods), `total_deductions` appears higher than during preview — but `net_pay` is correct because it comes directly from the snapshot. The visual mismatch is in the "Total Ded." column, not the actual net pay.

### What about "Preview vs Browser" Net Pay difference?

Both the Lovable preview panel and the published site call the same RPC against the same database. If you see different Net Pay values, the most likely cause is:

1. **Caching** — the Lovable preview may have stale React Query cache from before the function was fixed. A hard refresh (Ctrl+Shift+R) on either side would resolve this.
2. **Entity filter** — the preview and browser may have different entities selected, filtering different employee sets.

### Column Layout Difference

The preview panel and published site run the same code. Any layout difference would only occur if the published site hasn't been re-deployed after recent code changes. The column layout in `PayrollSummary.tsx` is hardcoded (18 columns) and hasn't changed — both should show identical headers.

### Plan: Fix the `total_deductions` display inconsistency

**One migration + one frontend edit:**

1. **Migration**: In the RPC, include `v_absence_ded` in `total_deductions` and remove it from `gross_pay` calculation so the accounting is transparent:
   - `v_gross_pay = base + OT + holiday + sunday + benefits` (no absence subtracted)
   - `total_deductions = tss + isr + loan + vacation + absence`
   - `net_pay = gross - total_deductions` (same final number, just clearer breakdown)

2. **Frontend fix** (PayrollSummary.tsx line 236): Remove the manual recalculation of `total_deductions` from snapshot data — just use `Number(s.gross_pay) - Number(s.net_pay)` or read the stored values consistently.

This makes the display consistent between preview (RPC) and committed (snapshot) views, and makes the table columns self-evident: Gross minus Total Deductions equals Net Pay.

### Technical Details

The net pay amount itself is correct in both cases — it's the intermediate display columns (Gross and Total Ded.) that show different breakdowns depending on whether you're viewing live RPC output vs committed snapshots. The fix restructures the calculation so both paths show identical column values.

