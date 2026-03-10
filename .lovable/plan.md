

## Add Inline Edit to Financial Ledger (Reports)

Make transaction rows clickable in the Reports page to open the existing `EditTransactionDialog`, allowing direct edits without navigating to the Transactions page. Posted/voided transactions will still be locked (handled by the dialog).

### Changes in `src/pages/Reports.tsx`

1. **Import** `EditTransactionDialog` and add state:
   - `selectedTransaction: Transaction | null`
   - `editDialogOpen: boolean`

2. **Row click handler** — On `<TableRow>` click, set `selectedTransaction` to the clicked transaction and open the dialog. Use `cursor-pointer` styling on rows.

3. **Render `EditTransactionDialog`** at the bottom of the component, passing `selectedTransaction`, `editDialogOpen`, and `onOpenChange`.

4. **Invalidation** — The dialog already invalidates `reportTransactions` on save, so the table will refresh automatically.

