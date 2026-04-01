
Goal: proactively harden embedded database queries so the same shorthand-relationship bug does not reappear elsewhere.

What I found
- Confirmed one more high-risk transaction query besides `src/lib/api.ts`:
  - `src/components/budget/BudgetGrid.tsx`
    - uses shorthand embeds on `transactions.account_id` and `transactions.cbs_id`
    - this is the same failure pattern that already broke Transactions/Ledger
- Found additional shorthand embeds in accounting/operations files that are not proven broken yet, but can be made explicit now to prevent future ambiguity:
  - `src/components/accounting/JournalView.tsx`
  - `src/components/operations/OperationsLogView.tsx`
  - `src/components/operations/InputUsageReport.tsx`
  - `src/components/operations/FieldProgressReport.tsx`
  - `src/components/alerts/useAlertData.ts`
  - `src/components/equipment/HourMeterSequenceView.tsx`
  - `supabase/functions/ai-search/index.ts`

Implementation plan
1. Patch all remaining transaction-based shorthand embeds
   - Update `src/components/budget/BudgetGrid.tsx` to use explicit relationship names for:
     - `chart_of_accounts!transactions_account_id_fkey`
     - `cbs_codes!transactions_cbs_id_fkey`

2. Proactively harden accounting embeds
   - Update `src/components/accounting/JournalView.tsx`
   - Replace nested shorthand `chart_of_accounts:account_id (...)` with explicit FK form using `journal_lines_account_id_fkey`

3. Proactively harden operations-related embeds
   - Update operations queries to explicit FK names where they currently rely on implicit relation resolution:
     - `fields!operations_field_id_fkey`
     - `operation_types!operations_operation_type_id_fkey`
     - `fuel_equipment!operations_tractor_id_fkey`
     - `implements!operations_implement_id_fkey`
     - nested `inventory_items!operation_inputs_inventory_item_id_fkey`
     - nested `operations!operation_inputs_operation_id_fkey`
     - `inventory_items!inventory_purchases_item_id_fkey` in AI search

4. Keep scope tight
   - Do not change query shapes, returned fields, or business logic
   - Only replace shorthand embed syntax with explicit relationship syntax

5. Verify affected screens/flows
   - Transactions page
   - Financial Ledger / journal listing
   - Budget actuals loading
   - Operations reports using nested related data
   - AI search context loading

Technical details
- The concrete pattern I would apply is:
```text
table_alias:referenced_table!foreign_key_constraint_name (...)
```
- Examples:
```text
chart_of_accounts:chart_of_accounts!transactions_account_id_fkey (...)
cbs_codes:cbs_codes!transactions_cbs_id_fkey (...)
chart_of_accounts:chart_of_accounts!journal_lines_account_id_fkey (...)
fields!operations_field_id_fkey (...)
inventory_items!operation_inputs_inventory_item_id_fkey (...)
```

Why this should prevent repeats
- The bug class comes from implicit embed resolution when schema relationships evolve
- Explicit FK names make queries stable even if more relationships are added later
- After this pass, the most important shared and high-traffic queries will no longer depend on shorthand resolution

Expected files to update
- `src/components/budget/BudgetGrid.tsx`
- `src/components/accounting/JournalView.tsx`
- `src/components/operations/OperationsLogView.tsx`
- `src/components/operations/InputUsageReport.tsx`
- `src/components/operations/FieldProgressReport.tsx`
- `src/components/alerts/useAlertData.ts`
- `src/components/equipment/HourMeterSequenceView.tsx`
- `supabase/functions/ai-search/index.ts`
